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
    const url = `/api/klines/${symbol}?interval=${interval}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`Backend Klines Error ${res.status}: ${errorBody} for symbol ${symbol}`);
      throw new Error(`Failed to fetch klines: ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error('Backend Klines Error:', err.message || err);
    return null;
  }
}

export async function fetchFunding(symbol) {
  try {
    const url = `/api/funding/${symbol}`;
    const res = await fetch(url);
    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`Backend Funding Error ${res.status}: ${errorBody} for symbol ${symbol}`);
      throw new Error(`Failed to fetch funding: ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error('Backend Funding Error:', err.message || err);
    return null;
  }
}

export async function fetchOpenInterest(symbol) {
  try {
    const url = `/api/open-interest/${symbol}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch open interest');
    return await res.json();
  } catch (err) {
    console.error('Backend Open Interest Error:', err);
    return null;
  }
}
