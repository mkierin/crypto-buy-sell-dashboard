// Signal Manager - Combines all signal detection algorithms
// Handles signal aggregation and cluster detection

const wavetrend = require('./wavetrend');
const rsi = require('./rsi');
const maCrossover = require('./ma_crossover');
const breakouts = require('./breakouts');

/**
 * Detect signals from all available indicators
 * @param {Array} klines - Array of klines data
 * @returns {Array} - Combined array of signals from all indicators
 */
function detectAllSignals(klines) {
  if (!klines || klines.length < 50) {
    return [];
  }
  
  // Collect signals from all detection algorithms
  const wavetrendSignals = wavetrend.detectSignals(klines);
  const rsiSignals = rsi.detectSignals(klines);
  const maCrossoverSignals = maCrossover.detectSignals(klines);
  const breakoutSignals = breakouts.detectSignals(klines);
  
  // Combine all signals
  const allSignals = [
    ...wavetrendSignals,
    ...rsiSignals,
    ...maCrossoverSignals,
    ...breakoutSignals
  ];
  
  // Detect cluster signals
  const clusterSignals = detectClusterSignals(allSignals, klines);
  
  return [...allSignals, ...clusterSignals];
}

/**
 * Detect cluster signals when multiple signals occur close together
 * @param {Array} signals - Array of detected signals
 * @param {Array} klines - Original klines data
 * @returns {Array} - Array of cluster signal objects
 */
function detectClusterSignals(signals, klines) {
  if (!signals || signals.length < 2) return [];
  
  const clusterSignals = [];
  const now = Date.now();
  
  // Group signals by type
  const buySignals = signals.filter(s => s.type === 'buy');
  const sellSignals = signals.filter(s => s.type === 'sell');
  
  // Get candle period in milliseconds
  const candlePeriod = getCandlePeriodMs(klines);
  
  // Check for buy clusters (3 or more buy signals within 5 candles)
  if (buySignals.length >= 3) {
    // Sort by timestamp
    buySignals.sort((a, b) => a.timestamp - b.timestamp);
    
    // Group signals by time proximity
    const buyGroups = groupSignalsByTime(buySignals, candlePeriod * 5);
    
    // Create cluster signals for groups with 3+ signals
    buyGroups.forEach(group => {
      if (group.length >= 3) {
        // Use the latest signal's timestamp and price
        const latestSignal = group[group.length - 1];
        
        // Get unique indicators in this cluster
        const indicators = [...new Set(group.map(s => s.indicator))];
        
        clusterSignals.push({
          type: 'buy',
          price: latestSignal.price,
          timestamp: latestSignal.timestamp,
          created_at: now,
          indicator: 'cluster',
          strength: 'strong',
          meta: {
            count: group.length,
            indicators: indicators
          }
        });
      }
    });
  }
  
  // Check for sell clusters (3 or more sell signals within 5 candles)
  if (sellSignals.length >= 3) {
    // Sort by timestamp
    sellSignals.sort((a, b) => a.timestamp - b.timestamp);
    
    // Group signals by time proximity
    const sellGroups = groupSignalsByTime(sellSignals, candlePeriod * 5);
    
    // Create cluster signals for groups with 3+ signals
    sellGroups.forEach(group => {
      if (group.length >= 3) {
        // Use the latest signal's timestamp and price
        const latestSignal = group[group.length - 1];
        
        // Get unique indicators in this cluster
        const indicators = [...new Set(group.map(s => s.indicator))];
        
        clusterSignals.push({
          type: 'sell',
          price: latestSignal.price,
          timestamp: latestSignal.timestamp,
          created_at: now,
          indicator: 'cluster',
          strength: 'strong',
          meta: {
            count: group.length,
            indicators: indicators
          }
        });
      }
    });
  }
  
  return clusterSignals;
}

/**
 * Group signals by time proximity
 * @param {Array} signals - Array of signals (should be pre-sorted by timestamp)
 * @param {Number} maxTimeDiff - Maximum time difference to be in the same group
 * @returns {Array} - Array of signal groups
 */
function groupSignalsByTime(signals, maxTimeDiff) {
  if (!signals.length) return [];
  
  const groups = [];
  let currentGroup = [signals[0]];
  
  for (let i = 1; i < signals.length; i++) {
    const currentSignal = signals[i];
    const lastSignal = currentGroup[currentGroup.length - 1];
    
    if (currentSignal.timestamp - lastSignal.timestamp <= maxTimeDiff) {
      // Add to current group
      currentGroup.push(currentSignal);
    } else {
      // Start a new group
      groups.push(currentGroup);
      currentGroup = [currentSignal];
    }
  }
  
  // Add the last group
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }
  
  return groups;
}

/**
 * Estimate the candle period in milliseconds based on the klines data
 * @param {Array} klines - Klines data
 * @returns {number} - Estimated candle period in milliseconds
 */
function getCandlePeriodMs(klines) {
  if (!klines || klines.length < 2) return 300000; // Default to 5m
  
  // Calculate the average time between candles
  let totalDiff = 0;
  let count = 0;
  
  for (let i = 1; i < Math.min(10, klines.length); i++) {
    const diff = parseInt(klines[i][0]) - parseInt(klines[i-1][0]);
    if (diff > 0) {
      totalDiff += diff;
      count++;
    }
  }
  
  return count > 0 ? Math.round(totalDiff / count) : 300000; // Default to 5m if calculation fails
}

module.exports = {
  detectAllSignals,
  detectClusterSignals
};
