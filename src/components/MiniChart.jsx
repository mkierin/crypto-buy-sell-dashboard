import React from 'react';
import PropTypes from 'prop-types';

// Simple line chart using SVG for price history
// Optionally marks the buy/sell signal
export default function MiniChart({ klines, signals, signal, triggeredAt }) {
  if (!Array.isArray(klines) || klines.length === 0) return <div style={{ padding: 16 }}>No chart data</div>;
  // Extract close prices
  const closes = klines.map(k => Number(k[4]));
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const w = 720, h = 320, pad = 40;
  // Bar width
  const barW = Math.max(2, ((w - 2 * pad) / klines.length) * 0.7);
  // Map closes to SVG points for line (optional, for signal)
  const points = closes.map((c, i) => {
    const x = pad + (i / (closes.length - 1)) * (w - 2 * pad);
    const y = pad + ((max - c) / (max - min || 1)) * (h - 2 * pad);
    return [x, y];
  });
  // Find signal indices for each type
  let indices = {};
  if (signals && typeof signals === 'object') {
    for (const key of ['wavetrend','rsi','ema']) {
      const s = signals[key];
      if (s && s.triggeredAt) {
        indices[key] = klines.findIndex(k => Math.abs(new Date(k[0]) - s.triggeredAt) < 60 * 1000);
      }
    }
  }
  // Backwards compatibility for single signal
  let signalIdx = null;
  if (triggeredAt) {
    signalIdx = klines.findIndex(k => {
      const t = new Date(k[0]);
      return Math.abs(t - triggeredAt) < 60 * 1000;
    });
  }
  return (
    <svg width={w} height={h} style={{ background: '#181a20', borderRadius: 12, margin: 8, boxShadow: '0 2px 24px #000b' }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
        <line
          key={i}
          x1={pad}
          x2={w - pad}
          y1={pad + t * (h - 2 * pad)}
          y2={pad + t * (h - 2 * pad)}
          stroke="#23263a"
          strokeWidth={i === 0 || i === 4 ? 2 : 1}
        />
      ))}
      {/* Y axis min/max labels */}
      <text x={pad - 8} y={pad + 8} fontSize="14" fill="#eee" textAnchor="end">{max.toFixed(2)}</text>
      <text x={pad - 8} y={h - pad} fontSize="14" fill="#eee" textAnchor="end">{min.toFixed(2)}</text>
      {/* X axis (bottom) */}
      <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} stroke="#444" strokeWidth="2" />
      {/* Candlestick bars */}
      {klines.map((k, i) => {
        const [openTime, open, high, low, close] = [k[0], +k[1], +k[2], +k[3], +k[4]];
        const x = pad + (i / (klines.length - 1)) * (w - 2 * pad);
        const yOpen = pad + ((max - open) / (max - min || 1)) * (h - 2 * pad);
        const yClose = pad + ((max - close) / (max - min || 1)) * (h - 2 * pad);
        const yHigh = pad + ((max - high) / (max - min || 1)) * (h - 2 * pad);
        const yLow = pad + ((max - low) / (max - min || 1)) * (h - 2 * pad);
        const up = close >= open;
        return (
          <g key={i}>
            {/* Wick */}
            <line x1={x} x2={x} y1={yHigh} y2={yLow} stroke={up ? '#00e1b4' : '#ff3860'} strokeWidth={2} />
            {/* Body */}
            <rect
              x={x - barW / 2}
              y={Math.min(yOpen, yClose)}
              width={barW}
              height={Math.abs(yClose - yOpen) || 2}
              fill={up ? '#00e1b4' : '#ff3860'}
              stroke="#23263a"
              rx={barW/4}
            />
          </g>
        );
      })}
      {/* Signal markers for each type */}
      {signals && indices.wavetrend != null && indices.wavetrend >= 0 && signals.wavetrend.signal && (
        <circle
          cx={points[indices.wavetrend][0]}
          cy={points[indices.wavetrend][1]}
          r={11}
          fill={signals.wavetrend.signal === 'Buy' ? '#00e1b4' : '#ff3860'}
          stroke="#fff"
          strokeWidth="3"
          style={{ filter: 'drop-shadow(0 0 8px #00e1b4)' }}
        />
      )}
      {signals && indices.rsi != null && indices.rsi >= 0 && signals.rsi.signal && (
        <circle
          cx={points[indices.rsi][0]}
          cy={points[indices.rsi][1]}
          r={9}
          fill={signals.rsi.signal === 'Buy' ? '#f3c900' : '#b47c00'}
          stroke="#fff"
          strokeWidth="3"
          style={{ filter: 'drop-shadow(0 0 8px #f3c900)' }}
        />
      )}
      {signals && indices.ema != null && indices.ema >= 0 && signals.ema.signal && (
        <circle
          cx={points[indices.ema][0]}
          cy={points[indices.ema][1]}
          r={7}
          fill={signals.ema.signal === 'Buy' ? '#e91e63' : '#7c1e3e'}
          stroke="#fff"
          strokeWidth="3"
          style={{ filter: 'drop-shadow(0 0 8px #e91e63)' }}
        />
      )}
      {/* Fallback for old API */}
      {signal && signalIdx != null && signalIdx >= 0 && (
        <circle
          cx={points[signalIdx][0]}
          cy={points[signalIdx][1]}
          r={10}
          fill={signal === 'Buy' ? '#00e1b4' : '#ff3860'}
          stroke="#fff"
          strokeWidth="3"
          style={{ filter: 'drop-shadow(0 0 8px #fff8)' }}
        />
      )}
    </svg>
  );
}

MiniChart.propTypes = {
  klines: PropTypes.array,
  signal: PropTypes.string,
  triggeredAt: PropTypes.instanceOf(Date)
};
