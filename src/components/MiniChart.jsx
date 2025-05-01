import React from 'react';
import PropTypes from 'prop-types';

// Helper to format timestamp as HH:mm:ss (24h)
function formatSignalTime(triggeredAt) {
  if (!triggeredAt) return '';
  const d = new Date(triggeredAt);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

// Simple line chart using SVG for price history
// Optionally marks the buy/sell signal
export default function MiniChart({ klines, signals }) {
  if (!Array.isArray(klines) || klines.length === 0) return <div style={{ padding: 16 }}>No chart data</div>;
  // Extract close prices
  const closes = klines.map(k => Number(k[4]));
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const w = 900, h = 320, pad = 48;
  // Bar width
  const barW = Math.max(2, ((w - 2 * pad) / klines.length) * 0.7);

  // Volume spike detection: volume > 2x avg of previous 20
  const volumeSpikes = [];
  for (let i = 20; i < klines.length; ++i) {
    const prev = klines.slice(i - 20, i);
    const avgVol = prev.reduce((a, k) => a + Number(k[5]), 0) / 20;
    const vol = Number(klines[i][5]);
    if (avgVol > 0 && vol > 2 * avgVol) {
      volumeSpikes.push(i);
    }
  }
  // Map closes to SVG points for line (optional, for signal)
  const points = closes.map((c, i) => {
    const x = pad + (i / (closes.length - 1)) * (w - 2 * pad);
    const y = pad + ((max - c) / (max - min || 1)) * (h - 2 * pad);
    return [x, y];
  });
  // Find signal indices for each type
  let indices = {};
  if (signals && typeof signals === 'object') {
    for (const key of ['wavetrend','rsi','ema','wt_ema','rsi_ema','wt_rsi','cluster','confluence']) {
      const s = signals[key];
      if (s && s.triggeredAt) {
        indices[key] = klines.findIndex(k => Math.abs(new Date(k[0]) - s.triggeredAt) < 60 * 1000);
      }
    }
  }

  // Draw dotted lines and price labels for all active signals
  let priceLines = [], priceLabels = [];
  if (signals && Array.isArray(signals.activeSignals) && signals.activeSignals.length > 0) {
    signals.activeSignals.forEach(sigKey => {
      const idx = indices[sigKey];
      const sigObj = signals[sigKey];
      if (idx != null && idx >= 0 && sigObj && sigObj.signal && points[idx]) {
        const [x, y] = points[idx];
        const labelX = x < w / 2 ? x + 60 : x - 60;
        const labelY = Math.max(pad + 18, Math.min(y, h - pad - 18));
        priceLines.push(
          <line
            key={sigKey + '-line'}
            x1={x}
            y1={y}
            x2={labelX}
            y2={labelY}
            stroke={sigObj.signal === 'Buy' ? '#00e1b4' : '#ff3860'}
            strokeWidth={2}
            strokeDasharray="6,5"
          />
        );
        priceLabels.push(
          <g key={sigKey + '-label'}>
            <rect
              x={labelX - 33}
              y={labelY - 17}
              width={66}
              height={28}
              rx={8}
              fill={sigObj.signal === 'Buy' ? '#00e1b4' : '#ff3860'}
              opacity={0.13}
            />
            <text
              x={labelX}
              y={labelY}
              fontSize="18"
              fill={sigObj.signal === 'Buy' ? '#00e1b4' : '#ff3860'}
              fontWeight="bold"
              textAnchor="middle"
              alignmentBaseline="middle"
              style={{ paintOrder: 'stroke fill', stroke: '#181a20', strokeWidth: 2 }}
            >
              {closes[idx]?.toFixed(2)}
            </text>
          </g>
        );
      }
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
      {/* Signal arrows for each active signal */}
      {signals && Array.isArray(signals.activeSignals) && signals.activeSignals.length > 0 && signals.activeSignals.map(sigKey => {
        const idx = indices[sigKey];
        const sigObj = signals[sigKey];
        if (idx != null && idx >= 0 && sigObj && sigObj.signal && points[idx]) {
          const [x, y] = points[idx];
          // Candle geometry
          const k = klines[idx];
          const high = +k[2], low = +k[3];
          const yHigh = pad + ((max - high) / (max - min || 1)) * (h - 2 * pad);
          const yLow = pad + ((max - low) / (max - min || 1)) * (h - 2 * pad);
          if (sigObj.signal === 'Buy') {
            // Green arrow up, below the candle
            return (
              <g key={sigKey + '-buy-group'}>
                {/* Arrow */}
                <polygon
                  points={`
                    ${x},${yLow + 12}
                    ${x - 8},${yLow + 24}
                    ${x + 8},${yLow + 24}
                  `}
                  fill="#00e1b4"
                  stroke="#00e1b4"
                  strokeWidth="2"
                  style={{ filter: 'drop-shadow(0 0 4px #00e1b4)' }}
                />
                {/* Info box */}
                <g>
                  <rect
                    x={x - 60}
                    y={yLow + 28}
                    width={120}
                    height={34}
                    rx={10}
                    fill="#181a20"
                    stroke="#00e1b4"
                    strokeWidth={2}
                    opacity={0.98}
                  />
                  <text
                    x={x - 46}
                    y={yLow + 50}
                    fontSize="16"
                    fill="#eee"
                    fontWeight="bold"
                    alignmentBaseline="middle"
                  >
                    ${closes[idx]?.toFixed(2)}
                  </text>
                  <text
                    x={x + 28}
                    y={yLow + 50}
                    fontSize="14"
                    fill="#aaa"
                    fontWeight="400"
                    alignmentBaseline="middle"
                  >
                    {formatSignalTime(sigObj.triggeredAt)}
                  </text>
                </g>
              </g>
            );
          } else if (sigObj.signal === 'Sell') {
            // Red arrow down, above the candle
            return (
              <g key={sigKey + '-sell-group'}>
                {/* Arrow */}
                <polygon
                  points={`
                    ${x},${yHigh - 12}
                    ${x - 8},${yHigh - 24}
                    ${x + 8},${yHigh - 24}
                  `}
                  fill="#ff3860"
                  stroke="#ff3860"
                  strokeWidth="2"
                  style={{ filter: 'drop-shadow(0 0 4px #ff3860)' }}
                />
                {/* Info box */}
                <g>
                  <rect
                    x={x - 60}
                    y={yHigh - 62}
                    width={120}
                    height={34}
                    rx={10}
                    fill="#181a20"
                    stroke="#ff3860"
                    strokeWidth={2}
                    opacity={0.98}
                  />
                  <text
                    x={x - 46}
                    y={yHigh - 40}
                    fontSize="16"
                    fill="#eee"
                    fontWeight="bold"
                    alignmentBaseline="middle"
                  >
                    ${closes[idx]?.toFixed(2)}
                  </text>
                  <text
                    x={x + 28}
                    y={yHigh - 40}
                    fontSize="14"
                    fill="#aaa"
                    fontWeight="400"
                    alignmentBaseline="middle"
                  >
                    {formatSignalTime(sigObj.triggeredAt)}
                  </text>
                </g>
              </g>
            );
          }
        }
        return null;
      })}
      {/* Volume spike markers */}
      {volumeSpikes.map(i => {
        const [x, y] = points[i];
        const k = klines[i];
        const low = +k[3];
        const yLow = pad + ((max - low) / (max - min || 1)) * (h - 2 * pad);
        const vol = Number(k[5]);
        return (
          <g key={'volspike-' + i}>
            {/* Purple diamond */}
            <rect
              x={x - 8}
              y={yLow + 32}
              width={16}
              height={16}
              fill="#b266ff"
              stroke="#fff"
              strokeWidth={2}
              transform={`rotate(45 ${x} ${yLow + 40})`}
              style={{ filter: 'drop-shadow(0 0 4px #b266ff)' }}
            />
            {/* Info box for volume spike */}
            <g>
              <rect
                x={x - 60}
                y={yLow + 52}
                width={120}
                height={32}
                rx={10}
                fill="#181a20"
                stroke="#b266ff"
                strokeWidth={2}
                opacity={0.98}
              />
              <text
                x={x - 46}
                y={yLow + 72}
                fontSize="15"
                fill="#eee"
                fontWeight="bold"
                alignmentBaseline="middle"
              >
                Vol: {vol.toLocaleString()}
              </text>
              <text
                x={x + 28}
                y={yLow + 72}
                fontSize="13"
                fill="#aaa"
                fontWeight="400"
                alignmentBaseline="middle"
              >
                {formatSignalTime(+k[0])}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

MiniChart.propTypes = {
  klines: PropTypes.array,
  signals: PropTypes.object
};
