// signals.js
// Implements comprehensive signal detection logic for dashboard
// Includes WaveTrend, RSI, Moving Averages, and Breakout signals
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
// Returns { wavetrend: {signal, triggeredAt, pctChange}, rsi: {...}, ema: {...} }
// Combo logic helpers
function agreeWithin(signals, keys, maxGap = 3) {
  // Returns {signal, idx} if all keys agree within maxGap candles
  const idxs = keys.map(k => signals[k].triggeredAt ? signals[k].idx : null);
  if (idxs.some(i => i == null)) return { signal: null, idx: null };
  const max = Math.max(...idxs), min = Math.min(...idxs);
  if (max - min <= maxGap) {
    const sigs = keys.map(k => signals[k].signal);
    if (sigs.every(s => s === sigs[0] && s)) return { signal: sigs[0], idx: max };
  }
  return { signal: null, idx: null };
}

export function getSignals(klines) {
  if (!klines || klines.length < 30) return {
    wavetrend: { signal: null, triggeredAt: null, pctChange: null },
    rsi: { signal: null, triggeredAt: null, pctChange: null },
    ema: { signal: null, triggeredAt: null, pctChange: null },
    ma_crossover: { signal: null, triggeredAt: null, pctChange: null },
    breakout: { signal: null, triggeredAt: null, pctChange: null },
    wt_ema: { signal: null, triggeredAt: null, pctChange: null },
    rsi_ema: { signal: null, triggeredAt: null, pctChange: null },
    wt_rsi: { signal: null, triggeredAt: null, pctChange: null },
    cluster: { signal: null, triggeredAt: null, pctChange: null },
  };
  const closes = klines.map(k => +k[4]);
  const highs = klines.map(k => +k[2]);
  const lows = klines.map(k => +k[3]);
  // --- Wavetrend: Buy if wt1 crosses above wt2 below -60, Sell if crosses below above +60 ---
  const { wt1, wt2 } = wavetrend(closes, highs, lows);
  let wtSignal = null, wtIdx = null;
  for (let i = wt1.length - 1; i > 0; --i) {
    // Enhanced sensitivity for WaveTrend signals
    if (wt1[i - 1] < wt2[i - 1] && wt1[i] > wt2[i] && wt2[i] <= -55) {
      wtSignal = 'Buy'; wtIdx = i; break;
    }
    if (wt1[i - 1] > wt2[i - 1] && wt1[i] < wt2[i] && wt2[i] >= 55) {
      wtSignal = 'Sell'; wtIdx = i; break;
    }
  }
  let wtPct = (wtIdx !== null && wtIdx < closes.length)
    ? ((closes[closes.length - 1] - closes[wtIdx]) / closes[wtIdx]) * 100 * (wtSignal === 'Buy' ? 1 : -1)
    : null;

  // --- RSI: Buy if RSI crosses above 30, Sell if crosses below 70 ---
  const rsiArr = rsi(closes, 21);
  let rsiSignal = null, rsiIdx = null;
  for (let i = rsiArr.length - 1; i > 0; --i) {
    if (rsiArr[i - 1] < 30 && rsiArr[i] >= 30) { rsiSignal = 'Buy'; rsiIdx = i; break; }
    if (rsiArr[i - 1] > 70 && rsiArr[i] <= 70) { rsiSignal = 'Sell'; rsiIdx = i; break; }
  }
  let rsiPct = (rsiIdx !== null && rsiIdx < closes.length)
    ? ((closes[closes.length - 1] - closes[rsiIdx]) / closes[rsiIdx]) * 100 * (rsiSignal === 'Buy' ? 1 : -1)
    : null;

  // --- EMA: Buy if price crosses above EMA21, Sell if crosses below ---
  const ema21 = ema(closes, 21);
  let emaSignal = null, emaIdx = null;
  for (let i = closes.length - 1; i > 0; --i) {
    if (closes[i - 1] <= ema21[i - 1] && closes[i] > ema21[i]) { emaSignal = 'Buy'; emaIdx = i; break; }
    if (closes[i - 1] >= ema21[i - 1] && closes[i] < ema21[i]) { emaSignal = 'Sell'; emaIdx = i; break; }
  }
  let emaPct = (emaIdx !== null && emaIdx < closes.length)
    ? ((closes[closes.length - 1] - closes[emaIdx]) / closes[emaIdx]) * 100 * (emaSignal === 'Buy' ? 1 : -1)
    : null;
    
  // --- MA Crossover: Buy if EMA20 crosses above EMA50, Sell if crosses below ---
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  let maCrossSignal = null, maCrossIdx = null;
  for (let i = closes.length - 1; i > 0; --i) {
    if (ema20[i - 1] <= ema50[i - 1] && ema20[i] > ema50[i]) { maCrossSignal = 'Buy'; maCrossIdx = i; break; }
    if (ema20[i - 1] >= ema50[i - 1] && ema20[i] < ema50[i]) { maCrossSignal = 'Sell'; maCrossIdx = i; break; }
  }
  let maCrossPct = (maCrossIdx !== null && maCrossIdx < closes.length)
    ? ((closes[closes.length - 1] - closes[maCrossIdx]) / closes[maCrossIdx]) * 100 * (maCrossSignal === 'Buy' ? 1 : -1)
    : null;
    
  // --- Breakout Detection: Simple support/resistance levels ---
  let breakoutSignal = null, breakoutIdx = null;
  // Look for price breaking above/below recent high/low
  if (closes.length >= 20) {
    const recentHigh = Math.max(...closes.slice(-20, -1));
    const recentLow = Math.min(...closes.slice(-20, -1));
    
    for (let i = closes.length - 1; i > closes.length - 5; --i) {
      // Breakout above resistance
      if (closes[i] > recentHigh * 1.02 && closes[i-1] <= recentHigh) {
        breakoutSignal = 'Buy'; breakoutIdx = i; break;
      }
      // Breakdown below support
      if (closes[i] < recentLow * 0.98 && closes[i-1] >= recentLow) {
        breakoutSignal = 'Sell'; breakoutIdx = i; break;
      }
    }
  }
  let breakoutPct = (breakoutIdx !== null && breakoutIdx < closes.length)
    ? ((closes[closes.length - 1] - closes[breakoutIdx]) / closes[breakoutIdx]) * 100 * (breakoutSignal === 'Buy' ? 1 : -1)
    : null;

  // --- Compose signals with indices for combos ---
  const signals = {
    wavetrend: {
      signal: wtSignal,
      triggeredAt: wtIdx !== null ? new Date(+klines[wtIdx][0]) : null,
      pctChange: wtPct,
      idx: wtIdx
    },
    rsi: {
      signal: rsiSignal,
      triggeredAt: rsiIdx !== null ? new Date(+klines[rsiIdx][0]) : null,
      pctChange: rsiPct,
      idx: rsiIdx
    },
    ema: {
      signal: emaSignal,
      triggeredAt: emaIdx !== null ? new Date(+klines[emaIdx][0]) : null,
      pctChange: emaPct,
      idx: emaIdx
    },
    ma_crossover: {
      signal: maCrossSignal,
      triggeredAt: maCrossIdx !== null ? new Date(+klines[maCrossIdx][0]) : null,
      pctChange: maCrossPct,
      idx: maCrossIdx
    },
    breakout: {
      signal: breakoutSignal,
      triggeredAt: breakoutIdx !== null ? new Date(+klines[breakoutIdx][0]) : null,
      pctChange: breakoutPct,
      idx: breakoutIdx
    }
  };

  // --- Combo Modes ---
  // 1. WT+EMA: WT signal confirmed by EMA trend
  let wt_ema = { signal: null, triggeredAt: null, pctChange: null };
  if (signals.wavetrend.signal && signals.ema.signal && signals.wavetrend.signal === signals.ema.signal) {
    const idx = Math.max(signals.wavetrend.idx, signals.ema.idx);
    const price = closes[idx];
    wt_ema = {
      signal: signals.wavetrend.signal,
      triggeredAt: idx !== null ? new Date(+klines[idx][0]) : null,
      pctChange: ((closes[closes.length - 1] - price) / price) * 100 * (signals.wavetrend.signal === 'Buy' ? 1 : -1)
    };
  }
  // 2. RSI+EMA
  let rsi_ema = { signal: null, triggeredAt: null, pctChange: null };
  if (signals.rsi.signal && signals.ema.signal && signals.rsi.signal === signals.ema.signal) {
    const idx = Math.max(signals.rsi.idx, signals.ema.idx);
    const price = closes[idx];
    rsi_ema = {
      signal: signals.rsi.signal,
      triggeredAt: idx !== null ? new Date(+klines[idx][0]) : null,
      pctChange: ((closes[closes.length - 1] - price) / price) * 100 * (signals.rsi.signal === 'Buy' ? 1 : -1)
    };
  }
  // 3. WT+RSI agreement
  let wt_rsi = { signal: null, triggeredAt: null, pctChange: null };
  const agree = agreeWithin(signals, ['wavetrend','rsi'], 3);
  if (agree.signal) {
    const price = closes[agree.idx];
    wt_rsi = {
      signal: agree.signal,
      triggeredAt: agree.idx !== null ? new Date(+klines[agree.idx][0]) : null,
      pctChange: ((closes[closes.length - 1] - price) / price) * 100 * (agree.signal === 'Buy' ? 1 : -1)
    };
  }
  // 4. Cluster: at least 2 of 5 agree (enhanced to include all signal types)
  let cluster = { signal: null, triggeredAt: null, pctChange: null };
  const sigs = [signals.wavetrend, signals.rsi, signals.ema, signals.ma_crossover, signals.breakout];
  const lastSignals = sigs.filter(s => s.signal && s.idx != null);
  if (lastSignals.length >= 2) {
    const buys = lastSignals.filter(s => s.signal === 'Buy');
    const sells = lastSignals.filter(s => s.signal === 'Sell');
    if (buys.length >= 2) {
      const idx = Math.max(...buys.map(s => s.idx));
      const price = closes[idx];
      // Get the indicators that contributed to this cluster
      const indicators = buys.map(s => {
        for (const [key, val] of Object.entries(signals)) {
          if (val === s) return key;
        }
        return null;
      }).filter(Boolean);
      
      cluster = {
        signal: 'Buy',
        triggeredAt: idx !== null ? new Date(+klines[idx][0]) : null,
        pctChange: ((closes[closes.length - 1] - price) / price) * 100,
        indicators: indicators,
        count: buys.length
      };
    } else if (sells.length >= 2) {
      const idx = Math.max(...sells.map(s => s.idx));
      const price = closes[idx];
      // Get the indicators that contributed to this cluster
      const indicators = sells.map(s => {
        for (const [key, val] of Object.entries(signals)) {
          if (val === s) return key;
        }
        return null;
      }).filter(Boolean);
      
      cluster = {
        signal: 'Sell',
        triggeredAt: idx !== null ? new Date(+klines[idx][0]) : null,
        pctChange: ((closes[closes.length - 1] - price) / price) * 100 * -1,
        indicators: indicators,
        count: sells.length
      };
    }
  }

  return {
    ...signals,
    wt_ema,
    rsi_ema,
    wt_rsi,
    cluster
  };
}
