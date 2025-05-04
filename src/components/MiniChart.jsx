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
  // Add console logs to debug signals
  console.log('MiniChart signals:', signals);
  console.log('MiniChart klines length:', klines?.length);
  
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
  
  // Format a timestamp for display on x-axis
  const formatTimeLabel = (timestamp) => {
    const date = new Date(Number(timestamp));
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };
  
  // Calculate safe boundaries for signal display
  const leftBoundary = pad + 80; // 80px from left edge
  const rightBoundary = w - pad - 80; // 80px from right edge
  const topBoundary = pad + 80; // 80px from top edge
  const bottomBoundary = h - pad - 80; // 80px from bottom edge
  
  // Function to ensure x-coordinate is within safe boundaries
  const getSafeX = (x) => {
    // If x is too close to the right edge, move it left
    if (x > rightBoundary) return rightBoundary;
    // If x is too close to the left edge, move it right
    if (x < leftBoundary) return leftBoundary;
    return x;
  };
  // Find all buy/sell signals and their indices
  const buySignals = [];
  const sellSignals = [];
  
  if (signals && typeof signals === 'object') {
    console.log('Available signal keys:', Object.keys(signals));
    
    // Process all signal types
    for (const key of ['wavetrend', 'rsi', 'ema', 'wt_ema', 'rsi_ema', 'wt_rsi', 'cluster', 'confluence']) {
      const s = signals[key];
      if (s && s.signal && s.triggeredAt) {
        console.log(`Found signal for ${key}:`, s.signal, s.triggeredAt);
        
        // Convert triggeredAt to Date if it's not already
        const triggeredTime = s.triggeredAt instanceof Date ? s.triggeredAt : new Date(s.triggeredAt);
        
        // Find the closest kline to the signal time
        const idx = klines.findIndex(k => {
          const klineTime = new Date(Number(k[0]));
          return Math.abs(klineTime - triggeredTime) < 60 * 1000;
        });
        
        if (idx >= 0) {
          const signalInfo = {
            key,
            idx,
            signal: s.signal,
            time: triggeredTime,
            price: parseFloat(klines[idx][4]) // close price
          };
          
          if (s.signal === 'Buy') {
            buySignals.push(signalInfo);
          } else if (s.signal === 'Sell') {
            sellSignals.push(signalInfo);
          }
        }
      }
    }
  }
  
  console.log('Buy signals found:', buySignals.length);
  console.log('Sell signals found:', sellSignals.length);

  // Draw dotted lines and price labels for all active signals
  let priceLines = [], priceLabels = [];
  // Create a map of signal keys to indices for active signals
  const signalIndices = {};
  
  // Populate the signalIndices map from our buySignals and sellSignals arrays
  buySignals.forEach(signal => {
    signalIndices[signal.key] = signal.idx;
  });
  sellSignals.forEach(signal => {
    signalIndices[signal.key] = signal.idx;
  });
  
  if (signals && Array.isArray(signals.activeSignals) && signals.activeSignals.length > 0) {
    signals.activeSignals.forEach(sigKey => {
      const idx = signalIndices[sigKey];
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
      
      {/* X-axis time labels */}
      {klines.filter((_, i) => i % Math.ceil(klines.length / 5) === 0 || i === klines.length - 1).map((k, i) => {
        const x = pad + (klines.indexOf(k) / (klines.length - 1)) * (w - 2 * pad);
        return (
          <g key={`time-${i}`}>
            <line
              x1={x}
              x2={x}
              y1={h - pad}
              y2={h - pad + 5}
              stroke="#23263a"
              strokeWidth={1}
            />
            <text
              x={x}
              y={h - pad + 18}
              fontSize="12"
              fill="#aaa"
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {formatTimeLabel(k[0])}
            </text>
          </g>
        );
      })}
      {/* Y axis min/max labels */}
      <text x={pad - 8} y={pad + 8} fontSize="14" fill="#eee" textAnchor="end">{max.toFixed(2)}</text>
      <text x={pad - 8} y={h - pad} fontSize="14" fill="#eee" textAnchor="end">{min.toFixed(2)}</text>
      {/* X axis (bottom) */}
      <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} stroke="#444" strokeWidth="2" />
      {/* Candlestick bars */}
      {klines.map((k, i) => {
         const open = +k[1], high = +k[2], low = +k[3], close = +k[4];
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
      {/* Buy signal markers */}
      {buySignals.map((signal, index) => {
        // Get original coordinates
        const [originalX] = points[signal.idx];
        const k = klines[signal.idx];
        const low = +k[3];
        const yLow = pad + ((max - low) / (max - min || 1)) * (h - 2 * pad);
        
        // Apply safety boundaries
        const safeX = getSafeX(originalX);
        const safeYLow = Math.min(bottomBoundary, yLow);
        
        // Calculate info box position
        // If near right edge, shift box to the left
        const boxOffsetX = originalX > w - pad - 150 ? -140 : -70;
        
        // Enhanced Buy signal with prominent marker and info box
        return (
          <g key={`buy-signal-${index}`}>
            {/* Triangle marker */}
            <polygon
              points={`
                ${safeX},${safeYLow + 10}
                ${safeX - 10},${safeYLow + 25}
                ${safeX + 10},${safeYLow + 25}
              `}
              fill="#00e1b4"
              stroke="#ffffff"
              strokeWidth="1.5"
              style={{ filter: 'drop-shadow(0 0 6px rgba(0,225,180,0.7))' }}
            />
            {/* Enhanced info box */}
            <g>
              <rect
                x={safeX + boxOffsetX}
                y={safeYLow + 28}
                width={140}
                height={48}
                rx={12}
                fill="rgba(0,225,180,0.15)"
                stroke="#00e1b4"
                strokeWidth={2}
                opacity={0.98}
              />
              {/* Price value */}
              <text
                x={safeX + boxOffsetX + 70}
                y={safeYLow + 45}
                fontSize="17"
                fill="#ffffff"
                fontWeight="bold"
                textAnchor="middle"
                alignmentBaseline="middle"
                style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}
              >
                ${signal.price.toFixed(2)}
              </text>
              {/* Time indicator - now below price */}
              <text
                x={safeX + boxOffsetX + 70}
                y={safeYLow + 65}
                fontSize="12"
                fill="#ffffff"
                fontWeight="500"
                textAnchor="middle"
                alignmentBaseline="middle"
                style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.5))' }}
              >
                {formatSignalTime(signal.time)}
              </text>
            </g>
          </g>
        );
      })}
      
      {/* Sell signal markers */}
      {sellSignals.map((signal, index) => {
        // Get original coordinates
        const [originalX] = points[signal.idx];
        const k = klines[signal.idx];
        const high = +k[2];
        const yHigh = pad + ((max - high) / (max - min || 1)) * (h - 2 * pad);
        
        // Apply safety boundaries
        const safeX = getSafeX(originalX);
        const safeYHigh = Math.max(topBoundary, yHigh);
        
        // Calculate info box position
        // If near right edge, shift box to the left
        const boxOffsetX = originalX > w - pad - 150 ? -140 : -70;
        
        // Enhanced Sell signal with prominent marker and info box
        return (
          <g key={`sell-signal-${index}`}>
            {/* Triangle marker */}
            <polygon
              points={`
                ${safeX},${safeYHigh - 10}
                ${safeX - 10},${safeYHigh - 25}
                ${safeX + 10},${safeYHigh - 25}
              `}
              fill="#ff3860"
              stroke="#ffffff"
              strokeWidth="1.5"
              style={{ filter: 'drop-shadow(0 0 6px rgba(255,56,96,0.7))' }}
            />
            {/* Enhanced info box */}
            <g>
              <rect
                x={safeX + boxOffsetX}
                y={safeYHigh - 76}
                width={140}
                height={48}
                rx={12}
                fill="rgba(255,56,96,0.15)"
                stroke="#ff3860"
                strokeWidth={2}
                opacity={0.98}
              />
              {/* Price value */}
              <text
                x={safeX + boxOffsetX + 70}
                y={safeYHigh - 60}
                fontSize="17"
                fill="#ffffff"
                fontWeight="bold"
                textAnchor="middle"
                alignmentBaseline="middle"
                style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}
              >
                ${signal.price.toFixed(2)}
              </text>
              {/* Time indicator - now below price */}
              <text
                x={safeX + boxOffsetX + 70}
                y={safeYHigh - 40}
                fontSize="12"
                fill="#ffffff"
                fontWeight="500"
                textAnchor="middle"
                alignmentBaseline="middle"
                style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.5))' }}
              >
                {formatSignalTime(signal.time)}
              </text>
            </g>
          </g>
        );
      })}
      {/* Volume bars */}
      {klines.map((k, i) => {
        const [x] = points[i];
        const vol = Number(k[5]);
        
        // Find max volume for scaling
        const maxVol = Math.max(...klines.map(k => Number(k[5])));
        
        // Calculate bar height based on volume relative to max
        const volHeight = Math.max(1, (vol / maxVol) * 60);
        
        // Check if this is a volume spike
        const isVolumeSpike = volumeSpikes.includes(i);
        
        return (
          <rect
            key={'vol-' + i}
            x={x - barW / 2}
            y={h - pad - volHeight}
            width={barW}
            height={volHeight}
            fill={isVolumeSpike ? '#4287f5' : '#2a2e39'}
            opacity={0.8}
          />
        );
      })}
    </svg>
  );
}

MiniChart.propTypes = {
  klines: PropTypes.array,
  signals: PropTypes.object
};
