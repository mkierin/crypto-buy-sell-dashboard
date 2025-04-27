// src/api/coingecko.js
// Functions to fetch market cap and other data from CoinGecko API

const BASE_URL = 'https://api.coingecko.com/api/v3';

export async function fetchMarketData(vs_currency = 'usd', per_page = 20, page = 1) {
  try {
    const res = await fetch(`${BASE_URL}/coins/markets?vs_currency=${vs_currency}&order=market_cap_desc&per_page=${per_page}&page=${page}&sparkline=false`);
    if (!res.ok) throw new Error('Failed to fetch market data');
    return await res.json();
  } catch (err) {
    console.error('CoinGecko Market Data Error:', err);
    return null;
  }
}
