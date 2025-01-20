import TelegramBot from "node-telegram-bot-api";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ccxt from "ccxt";
import dotenv from "dotenv";
import http from "http";

dotenv.config();

// Create a simple health check server
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      status: 200,
      message: "bot up and running",
    })
  );
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Health check server running on port ${PORT}`);
});

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN is missing");
  process.exit(1);
}

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY is missing");
  process.exit(1);
}

console.log("✅ Environment variables loaded");

// Initialize Telegram Bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Add error and polling error handlers
bot.on("error", (error) => {
  console.error("Telegram Bot Error:", error);
});

bot.on("polling_error", (error) => {
  console.error("Polling Error:", error);
});

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

// Initialize exchange (using Binance as an example)
const exchange = new ccxt.pro.bitget();

// Available trading pairs
const tradingPairs = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "XRP/USDT"];

// Function to create pair selection keyboard
function createPairKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: tradingPairs.map((pair) => [
        { text: pair, callback_data: `pair_${pair}` },
      ]),
    },
  };
}

// Function to fetch market data
async function getMarketData(symbol) {
  try {
    exchange.enableRateLimit = true;
    const ticker = await exchange.fetchTicker(symbol);
    const ohlcv = await exchange.fetchOHLCV(symbol, "1h", undefined, 24);

    return {
      symbol,
      price: ticker.last,
      volume: ticker.baseVolume,
      change24h: ticker.percentage,
      ohlcv: ohlcv.map((candle) => ({
        timestamp: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5],
      })),
    };
  } catch (error) {
    console.error(`Error fetching market data for ${symbol}:`, error);
    return null;
  }
}

// Function to analyze market data using Gemini
async function analyzeMarketData(marketData) {
  const prompt = `
    youre an expert future traders that provides trading signals for futures trading.
    as a future trading expert, your task is to analyze market data and provide trading signals for futures trading.
    please analyze this crypto market data and provide a trading signal for futures trading:
    Symbol: ${marketData.symbol}
    Current Price: ${marketData.price}
    24h Change: ${marketData.change24h}%
    24h Volume: ${marketData.volume}
    
    Recent price action (last 24 hours):
    ${marketData.ohlcv
      .slice(-5)
      .map(
        (candle) =>
          `Time: ${new Date(candle.timestamp).toISOString()}
       Open: ${candle.open}
       High: ${candle.high}
       Low: ${candle.low}
       Close: ${candle.close}
       Volume: ${candle.volume}`
      )
      .join("\n")}
    
    Provide a concise trading signal with:
    1. Position (LONG/SHORT), and when to open the position
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
    console.error("Error analyzing market data:", error);
    return null;
  }
}

// Function to generate and send trading signal for a specific pair
async function generateTradingSignal(chatId, pair) {
  const marketData = await getMarketData(pair);
  if (!marketData) {
    await bot.sendMessage(chatId, `❌ Error fetching data for ${pair}`);
    return;
  }

  const analysis = await analyzeMarketData(marketData);
  if (!analysis) {
    await bot.sendMessage(chatId, `❌ Error analyzing data for ${pair}`);
    return;
  }

  const message = `
🚨 CRYPTO TRADING SIGNAL 🚨

${pair} Analysis:
${analysis}

⚠️ Risk Disclaimer: This is AI-generated analysis. Always do your own research and trade responsibly.
`;

  await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
}

// Bot commands
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  console.log("✅ /start command received from chat ID:", chatId);
  await bot.sendMessage(
    chatId,
    `
Welcome to the Crypto Trading Signals Bot! 🤖

Available commands:
/signal - Get trading signals (select a pair)
/pairs - List monitored trading pairs
/help - Show this help message

Note: This bot provides AI-generated trading signals. Always verify signals and trade at your own risk.
  `
  );
});

bot.onText(/\/signal/, async (msg) => {
  const chatId = msg.chat.id;
  console.log("✅ /signal command received from chat ID:", chatId);
  await bot.sendMessage(
    chatId,
    "📊 Select a trading pair to analyze:",
    createPairKeyboard()
  );
});

// Handle callback queries for pair selection
bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data.startsWith("pair_")) {
    const selectedPair = data.replace("pair_", "");
    await bot.answerCallbackQuery(callbackQuery.id);
    await bot.sendMessage(
      chatId,
      `🔄 Generating trading signal for ${selectedPair}...`
    );
    await generateTradingSignal(chatId, selectedPair);
  }
});

bot.onText(/\/pairs/, async (msg) => {
  const chatId = msg.chat.id;
  console.log("✅ /pairs command received from chat ID:", chatId);
  await bot.sendMessage(
    chatId,
    `
Monitored Trading Pairs:
${tradingPairs.join("\n")}
  `
  );
});

console.log("🤖 Crypto Trading Signals Bot is starting...");
console.log("📊 Monitoring pairs:", tradingPairs.join(", "));

// Send a test message to verify bot is working
bot
  .getMe()
  .then((botInfo) => {
    console.log("✅ Bot connected successfully!");
    console.log("Bot username:", botInfo.username);
  })
  .catch((error) => {
    console.error("❌ Failed to connect to Telegram:", error);
  });
