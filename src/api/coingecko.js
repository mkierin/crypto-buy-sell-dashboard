// src/api/coingecko.js
// Functions to fetch market cap and other data from CoinGecko API

// Now fetches from backend proxy, which caches CoinGecko data
export async function fetchMarketData() {
  try {
    const res = await fetch(`/api/market-data`);
    if (!res.ok) throw new Error('Failed to fetch market data');
    return await res.json();
  } catch (err) {
    console.error('Backend Market Data Error:', err);
    return null;
  }
}
