// signals.js
// Implements Wavetrend, RSI, and EMA signal logic for dashboard
// Returns signal info for each method, for each kline array

// --- EMA ---
export function ema(arr, period) {
  if (!Array.isArray(arr) || arr.length < period) return [];
  let k = 2 / (period + 1);
  let emaArr = [];
  let prev = arr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  emaArr[period - 1] = prev;
  for (let i = period; i < arr.length; ++i) {
    prev = arr[i] * k + prev * (1 - k);
    emaArr[i] = prev;
  }
  return emaArr;
}

// --- RSI ---
export function rsi(arr, period = 14) {
  if (!Array.isArray(arr) || arr.length < period + 1) return [];
  let rsiArr = [];
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; ++i) {
    let diff = arr[i] - arr[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  rsiArr[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < arr.length; ++i) {
    let diff = arr[i] - arr[i - 1];
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - diff) / period;
    }
    rsiArr[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsiArr;
}

// --- Wavetrend ---
export function wavetrend(closes, highs, lows, chlLen = 13, avgLen = 21) {
  // Based on Pinescript: https://www.tradingview.com/script/2KE8Jd6W-WaveTrend-Oscillator/
  // Returns { wt1: number[], wt2: number[] }
  if (!closes || closes.length < Math.max(chlLen, avgLen)) return { wt1: [], wt2: [] };
  const hlc3 = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  const esa = ema(hlc3, chlLen);
  let d = hlc3.map((v, i) => Math.abs(v - (esa[i] || 0)));
  const de = ema(d, chlLen);
  let ci = hlc3.map((v, i) => (de[i] ? (v - (esa[i] || 0)) / (0.015 * de[i]) : 0));
  const wt1 = ema(ci, avgLen);
  let wt2 = [];
  for (let i = 0; i < wt1.length; ++i) {
    if (i < 2) wt2[i] = undefined;
    else wt2[i] = (wt1[i] + wt1[i - 1] + wt1[i - 2]) / 3;
  }
  return { wt1, wt2 };
}

// --- Signal extraction ---
// Returns { wavetrend: {signal, triggeredAt}, rsi: {signal, triggeredAt}, ema: {signal, triggeredAt} }
export function getSignals(klines) {
  if (!klines || klines.length < 30) return {
    wavetrend: { signal: null, triggeredAt: null },
    rsi: { signal: null, triggeredAt: null },
    ema: { signal: null, triggeredAt: null },
  };
  const closes = klines.map(k => +k[4]);
  const highs = klines.map(k => +k[2]);
  const lows = klines.map(k => +k[3]);
  // Wavetrend
  const { wt1, wt2 } = wavetrend(closes, highs, lows);
  let wtSignal = null, wtIdx = null;
  for (let i = wt1.length - 1; i > 0; --i) {
    if (wt1[i - 1] < wt2[i - 1] && wt1[i] > wt2[i] && wt2[i] <= -55) {
      wtSignal = 'Buy'; wtIdx = i; break;
    }
    if (wt1[i - 1] > wt2[i - 1] && wt1[i] < wt2[i] && wt2[i] >= 55) {
      wtSignal = 'Sell'; wtIdx = i; break;
    }
  }
  // RSI
  const rsiArr = rsi(closes, 21);
  let rsiSignal = null, rsiIdx = null;
  for (let i = rsiArr.length - 1; i > 0; --i) {
    if (rsiArr[i] < 30 && rsiArr[i] < ema(rsiArr, 13)[i]) { rsiSignal = 'Buy'; rsiIdx = i; break; }
    if (rsiArr[i] > 70 && rsiArr[i] > ema(rsiArr, 13)[i]) { rsiSignal = 'Sell'; rsiIdx = i; break; }
  }
  // EMA
  const ema21 = ema(closes, 21);
  let emaSignal = null, emaIdx = null;
  for (let i = closes.length - 1; i > 0; --i) {
    if (closes[i] > ema21[i] && closes[i - 1] <= ema21[i - 1]) { emaSignal = 'Buy'; emaIdx = i; break; }
    if (closes[i] < ema21[i] && closes[i - 1] >= ema21[i - 1]) { emaSignal = 'Sell'; emaIdx = i; break; }
  }
  return {
    wavetrend: { signal: wtSignal, triggeredAt: wtIdx !== null ? new Date(+klines[wtIdx][0]) : null },
    rsi: { signal: rsiSignal, triggeredAt: rsiIdx !== null ? new Date(+klines[rsiIdx][0]) : null },
    ema: { signal: emaSignal, triggeredAt: emaIdx !== null ? new Date(+klines[emaIdx][0]) : null },
  };
}
