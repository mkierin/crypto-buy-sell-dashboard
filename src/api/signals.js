// src/api/signals.js
// Functions to fetch signals data from backend

/**
 * Fetch all supported timeframes from the backend
 * @returns {Promise<string[]>} Array of supported timeframes
 */
export async function fetchTimeframes() {
  try {
    const res = await fetch('/api/timeframes');
    if (!res.ok) throw new Error('Failed to fetch timeframes');
    return await res.json();
  } catch (err) {
    console.error('Timeframes Error:', err);
    return ['5m', '15m', '1h', '4h', '1d']; // Fallback default timeframes
  }
}

/**
 * Fetch signals for a specific symbol and/or timeframe
 * @param {Object} options - Query options
 * @param {string} [options.symbol] - Optional symbol filter
 * @param {string} [options.interval] - Optional timeframe filter
 * @param {number} [options.limit=20] - Maximum number of signals to return
 * @returns {Promise<Array>} Array of signal objects
 */
export async function fetchSignals({ symbol, interval, limit = 20 }) {
  try {
    let url = `/api/signals?limit=${limit}`;
    if (symbol) url += `&symbol=${symbol}`;
    if (interval) url += `&interval=${interval}`;
    
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch signals');
    return await res.json();
  } catch (err) {
    console.error('Signals Error:', err);
    return [];
  }
}

/**
 * Fetch recent signals grouped by timeframe
 * @param {number} [limit=5] - Number of signals per timeframe
 * @returns {Promise<Object>} Object with timeframes as keys and arrays of signals as values
 */
export async function fetchRecentSignals(limit = 5) {
  try {
    const url = `/api/recent-signals?limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch recent signals');
    return await res.json();
  } catch (err) {
    console.error('Recent Signals Error:', err);
    return {};
  }
}
