import React from 'react';
import PropTypes from 'prop-types';

// Simple line chart using SVG for price history
// Optionally marks the buy/sell signal
export default function MiniChart({ klines, signal, triggeredAt }) {
  if (!Array.isArray(klines) || klines.length === 0) return <div style={{ padding: 16 }}>No chart data</div>;
  // Extract close prices
  const closes = klines.map(k => Number(k[4]));
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const w = 320, h = 80, pad = 16;
  // Map closes to SVG points
  const points = closes.map((c, i) => {
    const x = pad + (i / (closes.length - 1)) * (w - 2 * pad);
    const y = pad + ((max - c) / (max - min || 1)) * (h - 2 * pad);
    return [x, y];
  });
  // Find signal index (if any)
  let signalIdx = null;
  if (triggeredAt) {
    // Find kline with openTime closest to triggeredAt
    signalIdx = klines.findIndex(k => {
      const t = new Date(k[0]);
      return Math.abs(t - triggeredAt) < 60 * 1000; // within 1 min
    });
  }
  return (
    <svg width={w} height={h} style={{ background: '#181a20', borderRadius: 8, margin: 8 }}>
      {/* Chart line */}
      <polyline
        fill="none"
        stroke="#00e1b4"
        strokeWidth="2"
        points={points.map(([x, y]) => `${x},${y}`).join(' ')}
      />
      {/* Signal marker */}
      {signal && signalIdx != null && signalIdx >= 0 && (
        <circle
          cx={points[signalIdx][0]}
          cy={points[signalIdx][1]}
          r={6}
          fill={signal === 'Buy' ? '#00e1b4' : '#ff3860'}
          stroke="#fff"
          strokeWidth="2"
        />
      )}
      {/* Y axis min/max labels */}
      <text x={w - pad} y={pad + 12} fontSize="12" fill="#eee" textAnchor="end">{max.toFixed(2)}</text>
      <text x={w - pad} y={h - pad} fontSize="12" fill="#eee" textAnchor="end">{min.toFixed(2)}</text>
    </svg>
  );
}

MiniChart.propTypes = {
  klines: PropTypes.array,
  signal: PropTypes.string,
  triggeredAt: PropTypes.instanceOf(Date)
};
