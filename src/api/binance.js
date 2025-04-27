// src/api/binance.js
// Functions to fetch ticker, klines, funding, and open interest from Binance API

const BASE_URL = 'https://api.binance.com/api/v3';

export async function fetchTicker(symbol) {
  try {
    const res = await fetch(`${BASE_URL}/ticker/24hr?symbol=${symbol}`);
    if (!res.ok) throw new Error('Failed to fetch ticker');
    return await res.json();
  } catch (err) {
    console.error('Binance Ticker Error:', err);
    return null;
  }
}

export async function fetchKlines(symbol, interval = '1m', limit = 100) {
  try {
    const res = await fetch(`${BASE_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch klines');
    return await res.json();
  } catch (err) {
    console.error('Binance Klines Error:', err);
    return null;
  }
}

export async function fetchFunding(symbol) {
  // https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT
  try {
    const res = await fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`);
    if (!res.ok) throw new Error('Failed to fetch funding');
    return await res.json();
  } catch (err) {
    console.error('Binance Funding Error:', err);
    return null;
  }
}

export async function fetchOpenInterest(symbol) {
  // https://fapi.binance.com/futures/data/openInterestHist?symbol=BTCUSDT&period=5m&limit=10
  try {
    const res = await fetch(`https://fapi.binance.com/futures/data/openInterestHist?symbol=${symbol}&period=5m&limit=10`);
    if (!res.ok) throw new Error('Failed to fetch open interest');
    return await res.json();
  } catch (err) {
    console.error('Binance Open Interest Error:', err);
    return null;
  }
}


export async function fetchOpenInterest(symbol) {
  // Open interest endpoint (futures): https://fapi.binance.com/futures/data/openInterestHist
  try {
    const res = await fetch(`https://fapi.binance.com/futures/data/openInterestHist?symbol=${symbol}&period=5m&limit=10`);
    if (!res.ok) throw new Error('Failed to fetch open interest');
    return await res.json();
  } catch (err) {
    console.error('Binance Open Interest Error:', err);
    return null;
  }
}
