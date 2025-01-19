import TelegramBot from 'node-telegram-bot-api';
import { GoogleGenerativeAI } from '@google/generative-ai';
import ccxt from 'ccxt';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Telegram Bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

// Initialize exchange (using Binance as an example)
const exchange = new ccxt.binance();

// Trading pairs to monitor
const tradingPairs = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT'];

// Function to fetch market data
async function getMarketData(symbol) {
  try {
    const ticker = await exchange.fetchTicker(symbol);
    const ohlcv = await exchange.fetchOHLCV(symbol, '1h', undefined, 24); // Last 24 hours of hourly data
    
    return {
      symbol,
      price: ticker.last,
      volume: ticker.baseVolume,
      change24h: ticker.percentage,
      ohlcv: ohlcv.map(candle => ({
        timestamp: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5]
      }))
    };
  } catch (error) {
    console.error(`Error fetching market data for ${symbol}:`, error);
    return null;
  }
}

// Function to analyze market data using Gemini
async function analyzeMarketData(marketData) {
  const prompt = `
    Analyze this crypto market data and provide a trading signal for futures trading:
    Symbol: ${marketData.symbol}
    Current Price: ${marketData.price}
    24h Change: ${marketData.change24h}%
    24h Volume: ${marketData.volume}
    
    Recent price action (last 24 hours):
    ${marketData.ohlcv.slice(-5).map(candle => 
      `Time: ${new Date(candle.timestamp).toISOString()}
       Open: ${candle.open}
       High: ${candle.high}
       Low: ${candle.low}
       Close: ${candle.close}
       Volume: ${candle.volume}`
    ).join('\n')}
    
    Provide a concise trading signal with:
    1. Position (LONG/SHORT)
    2. Entry price
    3. Stop loss
    4. Take profit targets
    5. Risk level (Low/Medium/High)
    6. Brief reasoning
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error analyzing market data:', error);
    return null;
  }
}

// Function to generate and send trading signals
async function generateTradingSignal(chatId) {
  for (const pair of tradingPairs) {
    const marketData = await getMarketData(pair);
    if (!marketData) continue;

    const analysis = await analyzeMarketData(marketData);
    if (!analysis) continue;

    const message = `
🚨 CRYPTO TRADING SIGNAL 🚨

${pair} Analysis:
${analysis}

⚠️ Risk Disclaimer: This is AI-generated analysis. Always do your own research and trade responsibly.
`;

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }
}

// Bot commands
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, `
Welcome to the Crypto Trading Signals Bot! 🤖

Available commands:
/signal - Get new trading signals
/pairs - List monitored trading pairs
/help - Show this help message

Note: This bot provides AI-generated trading signals. Always verify signals and trade at your own risk.
  `);
});

bot.onText(/\/signal/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, '🔄 Generating trading signals...');
  await generateTradingSignal(chatId);
});

bot.onText(/\/pairs/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, `
Monitored Trading Pairs:
${tradingPairs.join('\n')}
  `);
});

console.log('Crypto Trading Signals Bot is running...');