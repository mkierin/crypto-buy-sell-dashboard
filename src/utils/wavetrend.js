// Placeholder for Wavetrend oscillator and signal logic
// Returns { signal: 'Buy' | 'Sell' | null, triggeredAt: Date | null }

// For demo, randomly trigger a signal in the last N candles
export function getWavetrendSignal(klines, interval) {
  // In production, replace with real calculation!
  if (!klines || klines.length === 0) return { signal: null, triggeredAt: null };
  // Randomly pick a candle index for signal (for demo)
  const idx = Math.floor(Math.random() * klines.length);
  const candle = klines[idx];
  const openTime = candle[0]; // Binance kline open time (ms)
  const signal = Math.random() > 0.5 ? 'Buy' : 'Sell';
  return { signal, triggeredAt: new Date(openTime) };
}

// Helper to format elapsed time since signal
export function formatSignalAgo(triggeredAt, now, interval) {
  if (!triggeredAt) return '';
  const diffMs = now - triggeredAt;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
}
