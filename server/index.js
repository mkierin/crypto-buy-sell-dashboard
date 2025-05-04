// Simple backend proxy/cache for crypto dashboard
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

// --- SQLite DB setup ---
const db = new sqlite3.Database(path.join(__dirname, 'crypto.db'));
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS market_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS klines (
    symbol TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS funding (
    symbol TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS open_interest (
    symbol TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  )`);
});

// --- Helper: get market data from DB or API ---
async function getMarketData() {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM market_data ORDER BY timestamp DESC LIMIT 1', async (err, row) => {
      const now = Date.now();
      const maxAge = 5 * 60 * 1000; // 5 minutes
      if (row && now - row.timestamp < maxAge) {
        // Return cached
        resolve(JSON.parse(row.data));
      } else {
        // Fetch from CoinGecko
        try {
          const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false';
          const res = await fetch(url);
          if (!res.ok) throw new Error('Failed to fetch CoinGecko');
          const data = await res.json();
          db.run('INSERT INTO market_data (data, timestamp) VALUES (?, ?)', [JSON.stringify(data), now]);
          resolve(data);
        } catch (e) {
          reject(e);
        }
      }
    });
  });
}

// --- API endpoint ---
app.get('/api/market-data', async (req, res) => {
  try {
    const data = await getMarketData();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Helper: get klines from DB or Binance ---
// Helper to sleep for ms
function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function getKlines(symbol, interval = '1h', limit = 3000) {
  // Fetch up to 3000 klines in batches of 500, with a delay to avoid rate limits
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM klines WHERE symbol = ?', [symbol], async (err, row) => {
      if (row) {
        // Serve all cached klines
        resolve(JSON.parse(row.data));
      } else {
        try {
          let allKlines = [];
          let endTime = undefined;
          const batchSize = 500;
          for (let i = 0; i < limit / batchSize; ++i) {
            let url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${batchSize}`;
            if (endTime) url += `&endTime=${endTime}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to fetch klines');
            const batch = await res.json();
            if (!batch.length) break;
            allKlines = batch.concat(allKlines); // prepend to keep chronological order
            endTime = batch[0][0] - 1; // next batch ends before earliest openTime
            await sleep(700); // 700ms delay between requests
            if (batch.length < batchSize) break; // no more data
          }
          db.run('REPLACE INTO klines (symbol, data, timestamp) VALUES (?, ?, ?)', [symbol, JSON.stringify(allKlines), Date.now()]);
          resolve(allKlines);
        } catch (e) {
          reject(e);
        }
      }
    });
  });
}

// --- Helper: get funding from DB or Binance ---
async function getFunding(symbol) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM funding WHERE symbol = ?', [symbol], async (err, row) => {
      const now = Date.now();
      const maxAge = 60 * 60 * 1000; // 1 hour
      if (row && now - row.timestamp < maxAge) {
        resolve(JSON.parse(row.data));
      } else {
        try {
          const url = `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`;
          const res = await fetch(url);
          if (!res.ok) {
            // Binance returns 4xx for unsupported symbols. Log and return null/empty.
            console.warn(`[funding] Binance returned ${res.status} for symbol ${symbol}`);
            resolve(null);
            return;
          }
          const data = await res.json();
          db.run('REPLACE INTO funding (symbol, data, timestamp) VALUES (?, ?, ?)', [symbol, JSON.stringify(data), now]);
          resolve(data);
        } catch (e) {
          reject(e);
        }
      }
    });
  });
}

// --- Helper: get open interest from DB or Binance ---
async function getOpenInterest(symbol) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM open_interest WHERE symbol = ?', [symbol], async (err, row) => {
      const now = Date.now();
      const maxAge = 60 * 60 * 1000; // 1 hour
      if (row && now - row.timestamp < maxAge) {
        resolve(JSON.parse(row.data));
      } else {
        try {
          const url = `https://fapi.binance.com/futures/data/openInterestHist?symbol=${symbol}&period=5m&limit=10`;
          const res = await fetch(url);
          if (!res.ok) throw new Error('Failed to fetch open interest');
          const data = await res.json();
          db.run('REPLACE INTO open_interest (symbol, data, timestamp) VALUES (?, ?, ?)', [symbol, JSON.stringify(data), now]);
          resolve(data);
        } catch (e) {
          reject(e);
        }
      }
    });
  });
}

// --- API endpoints ---
app.get('/api/klines/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const { interval = '1h', limit = 50 } = req.query;
  console.log(`[klines] Request: symbol=${symbol}, interval=${interval}, limit=${limit}`);
  try {
    const data = await getKlines(symbol, interval, limit);
    res.json(data);
  } catch (e) {
    console.error(`[klines] Error:`, e);
    res.status(500).json({ error: e.message, details: e.stack });
  }
});

app.get('/api/funding/:symbol', async (req, res) => {
  const { symbol } = req.params;
  console.log(`[funding] Request: symbol=${symbol}`);
  try {
    const data = await getFunding(symbol);
    res.json(data);
  } catch (e) {
    console.error(`[funding] Error:`, e);
    res.status(500).json({ error: e.message, details: e.stack });
  }
});

app.get('/api/open-interest/:symbol', async (req, res) => {
  const { symbol } = req.params;
  console.log(`[open-interest] Request: symbol=${symbol}`);
  try {
    const data = await getOpenInterest(symbol);
    res.json(data);
  } catch (e) {
    console.error(`[open-interest] Error:`, e);
    res.status(500).json({ error: e.message, details: e.stack });
  }
});

app.listen(PORT, () => {
  console.log(`Crypto backend running on port ${PORT}`);
});
