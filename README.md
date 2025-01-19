# Crypto Trading Signals Telegram Bot

This bot provides AI-generated crypto trading signals using Google's Gemini LLM for futures trading.

## Setup

1. Create a new Telegram bot using BotFather and get the token
2. Get a Google Gemini API key
3. Add the tokens to the `.env` file:
   ```
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   GEMINI_API_KEY=your_gemini_api_key
   ```
4. Install dependencies: `npm install`
5. Start the bot: `npm start`

## Features

- Monitors multiple trading pairs
- Generates AI-powered trading signals using Google Gemini
- Provides entry, stop loss, and take profit levels
- Risk assessment for each trade
- Real-time market data analysis

## Commands

- `/start` - Start the bot and see available commands
- `/signal` - Get new trading signals
- `/pairs` - List monitored trading pairs
- `/help` - Show help message

## Disclaimer

This bot provides AI-generated trading signals for educational purposes only. Always do your own research and trade responsibly.