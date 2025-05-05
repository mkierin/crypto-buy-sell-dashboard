// Simple backend proxy/cache for crypto dashboard
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fetch = require('node-fetch');
const path = require('path');
const wavetrend = require('./signals/wavetrend');
const signalManager = require('./signals/index');

const app = express();
const PORT = process.env.PORT || 4000;

// CORS middleware for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Supported timeframes for background fetching
const SUPPORTED_TIMEFRAMES = ['5m', '15m', '1h', '4h', '1d'];

// Top coins to continuously monitor
const TOP_COINS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'MATICUSDT'
];

// --- SQLite DB setup ---
const db = new sqlite3.Database(path.join(__dirname, 'crypto.db'));

// Drop existing tables to recreate schema
db.serialize(() => {
  // Drop existing tables to avoid schema conflicts
  db.run(`DROP TABLE IF EXISTS klines`);
  db.run(`DROP TABLE IF EXISTS signals`);
  
  // Create tables with new schema
  db.run(`CREATE TABLE IF NOT EXISTS market_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS klines (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    interval TEXT NOT NULL,
    data TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    interval TEXT NOT NULL,
    type TEXT NOT NULL,
    price REAL NOT NULL,
    timestamp INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    indicator TEXT,
    strength TEXT,
    meta TEXT
  )`);
  
  // Create indexes for faster lookups
  db.run(`CREATE INDEX IF NOT EXISTS idx_klines_symbol_interval ON klines(symbol, interval)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_signals_symbol_interval ON signals(symbol, interval)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON signals(timestamp DESC)`);
  
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
  
  console.log('Database schema created successfully');
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

// --- API endpoint for supported timeframes ---
app.get('/api/timeframes', (req, res) => {
  res.json(SUPPORTED_TIMEFRAMES);
});

// --- Helper: get klines from DB or Binance ---
// Helper to sleep for ms
function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function getKlines(symbol, interval = '1h', limit = 3000) {
  // Fetch up to 3000 klines in batches of 500, with a delay to avoid rate limits
  return new Promise((resolve, reject) => {
    const cacheKey = `${symbol}_${interval}`;
    db.get('SELECT * FROM klines WHERE id = ?', [cacheKey], async (err, row) => {
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
          db.run('REPLACE INTO klines (id, symbol, interval, data, timestamp) VALUES (?, ?, ?, ?, ?)', 
                [cacheKey, symbol, interval, JSON.stringify(allKlines), Date.now()]);
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

// --- Helper: detect buy/sell signals ---
async function detectSignals(symbol, interval, klines) {
  if (!klines || klines.length < 50) return; // Need enough data for signals
  
  const now = Date.now();
  
  // Use comprehensive signal detection system
  const allSignals = signalManager.detectAllSignals(klines);
  
  // Add symbol and interval to each signal
  const signals = allSignals.map(signal => ({
    ...signal,
    symbol,
    interval
  }));
  
  // Save signals to database
  if (signals.length > 0) {
    // First, delete old signals for this symbol and interval to avoid duplicates
    // Only keep signals from the last 24 hours to avoid deleting historical data
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    db.run('DELETE FROM signals WHERE symbol = ? AND interval = ? AND created_at > ?', 
      [symbol, interval, oneDayAgo]);
    
    const stmt = db.prepare('INSERT INTO signals (symbol, interval, type, price, timestamp, created_at, indicator, strength, meta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    signals.forEach(signal => {
      // Convert meta object to JSON string if it exists
      const metaJson = signal.meta ? JSON.stringify(signal.meta) : null;
      
      stmt.run(
        signal.symbol,
        signal.interval,
        signal.type,
        signal.price,
        signal.timestamp,
        signal.created_at,
        signal.indicator || 'unknown',
        signal.strength || 'medium',
        metaJson
      );
    });
    stmt.finalize();
    console.log(`[signals] Detected ${signals.length} signals for ${symbol} (${interval})`);
  }
}

// Helper to calculate EMA
function calculateEMA(prices, period) {
  const k = 2 / (period + 1);
  let ema = [prices[0]];
  
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i-1] * (1-k));
  }
  
  return ema;
}

// --- Background job to fetch data for all timeframes ---
async function backgroundFetchAllTimeframes() {
  console.log('[background] Starting background fetch for all timeframes');
  
  try {
    // Fetch market data first to get top coins
    await getMarketData();
    
    // For each supported timeframe, fetch data for top coins
    for (const interval of SUPPORTED_TIMEFRAMES) {
      for (const symbol of TOP_COINS) {
        try {
          // Check if we have existing data for this symbol and interval
          const lastTimestamp = await getLastKlinesTimestamp(symbol, interval);
          const now = Date.now();
          
          // If we have data and it's not too old, just update with recent data
          // Otherwise, fetch a larger history to fill in gaps
          let limit = 100; // Default to recent data
          
          if (lastTimestamp) {
            // Calculate how many bars we might have missed based on the interval
            const intervalMs = getIntervalInMs(interval);
            const timeSinceLastBar = now - lastTimestamp;
            const missedBars = Math.ceil(timeSinceLastBar / intervalMs);
            
            // If we've missed more than a few bars, fetch more history
            if (missedBars > 5) {
              limit = Math.min(1000, missedBars + 50); // Fetch missed bars + some buffer
              console.log(`[background] Detected gap of ~${missedBars} bars for ${symbol} (${interval}), fetching ${limit} bars`);
            }
          } else {
            // No existing data, fetch more history
            limit = 1000;
            console.log(`[background] No existing data for ${symbol} (${interval}), fetching ${limit} bars`);
          }
          
          console.log(`[background] Fetching ${symbol} for ${interval}`);
          const klines = await getKlines(symbol, interval, limit);
          
          // Detect and save signals
          await detectSignals(symbol, interval, klines);
          
          // Add a small delay to avoid rate limits
          await sleep(300);
        } catch (error) {
          console.error(`[background] Error fetching ${symbol} for ${interval}:`, error);
        }
      }
    }
    
    console.log('[background] Completed background fetch');
  } catch (error) {
    console.error('[background] Error in background fetch:', error);
  }
  
  // Schedule next run
  setTimeout(backgroundFetchAllTimeframes, 5 * 60 * 1000); // Run every 5 minutes
}

// Helper to get the last timestamp from klines data
async function getLastKlinesTimestamp(symbol, interval) {
  return new Promise((resolve, reject) => {
    const cacheKey = `${symbol}_${interval}`;
    db.get('SELECT * FROM klines WHERE id = ?', [cacheKey], (err, row) => {
      if (err) {
        console.error(`Error getting last timestamp for ${symbol} (${interval}):`, err);
        resolve(null);
        return;
      }
      
      if (!row) {
        resolve(null);
        return;
      }
      
      try {
        const data = JSON.parse(row.data);
        if (data && data.length > 0) {
          // Klines data structure: [timestamp, open, high, low, close, ...]
          // Get the timestamp of the most recent candle
          const lastCandle = data[data.length - 1];
          resolve(parseInt(lastCandle[0]));
        } else {
          resolve(null);
        }
      } catch (e) {
        console.error(`Error parsing data for ${symbol} (${interval}):`, e);
        resolve(null);
      }
    });
  });
}

// Helper to convert interval string to milliseconds
function getIntervalInMs(interval) {
  const unit = interval.slice(-1);
  const value = parseInt(interval.slice(0, -1));
  
  switch (unit) {
    case 'm': return value * 60 * 1000; // minutes
    case 'h': return value * 60 * 60 * 1000; // hours
    case 'd': return value * 24 * 60 * 60 * 1000; // days
    case 'w': return value * 7 * 24 * 60 * 60 * 1000; // weeks
    default: return 60 * 60 * 1000; // default to 1 hour
  }
}

// --- API endpoint for signals ---
app.get('/api/signals', async (req, res) => {
  try {
    const { symbol, interval, limit = 20 } = req.query;
    let query = 'SELECT * FROM signals';
    const params = [];
    const conditions = [];
    
    if (symbol) {
      conditions.push('symbol = ?');
      params.push(symbol);
    }
    
    if (interval) {
      conditions.push('interval = ?');
      params.push(interval);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(parseInt(limit));
    
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('[signals] Error:', err);
        return res.status(500).json({ error: err.message });
      }
      
      // Parse meta JSON field if it exists
      const processedRows = rows.map(row => {
        if (row.meta) {
          try {
            row.meta = JSON.parse(row.meta);
          } catch (e) {
            console.error('[signals] Error parsing meta JSON:', e);
          }
        }
        return row;
      });
      
      res.json(processedRows);
    });
  } catch (e) {
    console.error('[signals] Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// --- API endpoint for recent signals per timeframe ---
app.get('/api/recent-signals', async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const result = {};
    
    // For each timeframe, get the most recent signals
    for (const interval of SUPPORTED_TIMEFRAMES) {
      const query = 'SELECT * FROM signals WHERE interval = ? ORDER BY timestamp DESC LIMIT ?';
      
      // Use a promise to handle the async DB query
      const signals = await new Promise((resolve, reject) => {
        db.all(query, [interval, parseInt(limit)], (err, rows) => {
          if (err) reject(err);
          else {
            // Parse meta JSON field if it exists
            const processedRows = rows.map(row => {
              if (row.meta) {
                try {
                  row.meta = JSON.parse(row.meta);
                } catch (e) {
                  console.error('[recent-signals] Error parsing meta JSON:', e);
                }
              }
              return row;
            });
            resolve(processedRows);
          }
        });
      });
      
      result[interval] = signals;
    }
    
    res.json(result);
  } catch (e) {
    console.error('[recent-signals] Error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Crypto backend running on port ${PORT}`);
  
  // Start the background fetching process
  backgroundFetchAllTimeframes();
});
