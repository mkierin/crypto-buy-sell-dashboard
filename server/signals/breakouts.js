// Support/Resistance Breakout signal detection algorithm
// Detects price breakouts from key levels

/**
 * Find pivot points (potential support/resistance levels)
 * @param {Array} klines - Array of klines data
 * @param {Number} lookback - Number of candles to look back/forward
 * @returns {Array} - Array of pivot points with their levels
 */
function findPivotPoints(klines, lookback = 5) {
  const pivots = [];
  
  // Need at least 2*lookback+1 candles to find a pivot
  if (klines.length < 2 * lookback + 1) {
    return pivots;
  }
  
  for (let i = lookback; i < klines.length - lookback; i++) {
    const currentHigh = parseFloat(klines[i][2]); // High price
    const currentLow = parseFloat(klines[i][3]);  // Low price
    
    let isHighPivot = true;
    let isLowPivot = true;
    
    // Check if this is a high pivot (local maximum)
    for (let j = i - lookback; j < i + lookback + 1; j++) {
      if (j === i) continue; // Skip the current candle
      
      const compareHigh = parseFloat(klines[j][2]);
      if (compareHigh > currentHigh) {
        isHighPivot = false;
        break;
      }
    }
    
    // Check if this is a low pivot (local minimum)
    for (let j = i - lookback; j < i + lookback + 1; j++) {
      if (j === i) continue; // Skip the current candle
      
      const compareLow = parseFloat(klines[j][3]);
      if (compareLow < currentLow) {
        isLowPivot = false;
        break;
      }
    }
    
    if (isHighPivot) {
      pivots.push({
        type: 'resistance',
        level: currentHigh,
        index: i,
        timestamp: parseInt(klines[i][0])
      });
    }
    
    if (isLowPivot) {
      pivots.push({
        type: 'support',
        level: currentLow,
        index: i,
        timestamp: parseInt(klines[i][0])
      });
    }
  }
  
  return pivots;
}

/**
 * Group nearby pivot levels to form stronger support/resistance zones
 * @param {Array} pivots - Array of pivot points
 * @param {Number} tolerance - Percentage tolerance for grouping
 * @returns {Array} - Array of grouped pivot zones
 */
function groupPivotLevels(pivots, tolerance = 0.005) {
  if (pivots.length === 0) return [];
  
  // Sort pivots by level
  const sortedPivots = [...pivots].sort((a, b) => a.level - b.level);
  
  const groups = [];
  let currentGroup = [sortedPivots[0]];
  
  for (let i = 1; i < sortedPivots.length; i++) {
    const currentPivot = sortedPivots[i];
    const lastPivot = currentGroup[currentGroup.length - 1];
    
    // Check if current pivot is within tolerance of the last one in the group
    const percentDiff = Math.abs(currentPivot.level - lastPivot.level) / lastPivot.level;
    
    if (percentDiff <= tolerance) {
      // Add to current group
      currentGroup.push(currentPivot);
    } else {
      // Start a new group
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [currentPivot];
    }
  }
  
  // Add the last group if it's not empty
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }
  
  // Calculate the average level for each group
  return groups.map(group => {
    const avgLevel = group.reduce((sum, pivot) => sum + pivot.level, 0) / group.length;
    const dominantType = group.filter(p => p.type === 'support').length > group.length / 2 ? 'support' : 'resistance';
    const strength = Math.min(1, group.length / 3); // Normalize strength based on number of pivots
    
    return {
      type: dominantType,
      level: avgLevel,
      strength: strength,
      count: group.length,
      pivots: group
    };
  });
}

/**
 * Detect breakout signals
 * @param {Array} klines - Array of klines data
 * @returns {Array} - Array of breakout signals
 */
function detectSignals(klines) {
  if (!klines || klines.length < 50) {
    return [];
  }
  
  const signals = [];
  const now = Date.now();
  
  // Find pivot points
  const pivots = findPivotPoints(klines, 5);
  
  // Group pivot points into zones
  const zones = groupPivotLevels(pivots);
  
  // Only consider strong zones (with multiple pivots)
  const strongZones = zones.filter(zone => zone.count >= 2);
  
  // Check the most recent candles for breakouts
  const recentCandles = klines.slice(-10); // Last 10 candles
  
  for (let i = 1; i < recentCandles.length; i++) {
    const prevCandle = recentCandles[i-1];
    const currentCandle = recentCandles[i];
    
    const prevClose = parseFloat(prevCandle[4]);
    const currentOpen = parseFloat(currentCandle[1]);
    const currentHigh = parseFloat(currentCandle[2]);
    const currentLow = parseFloat(currentCandle[3]);
    const currentClose = parseFloat(currentCandle[4]);
    const timestamp = parseInt(currentCandle[0]);
    
    // Check for breakouts through each zone
    for (const zone of strongZones) {
      // Resistance breakout (buy signal)
      if (zone.type === 'resistance' && 
          prevClose < zone.level && 
          currentClose > zone.level * 1.005) { // 0.5% confirmation
        
        signals.push({
          type: 'buy',
          price: currentClose,
          timestamp,
          created_at: now,
          indicator: 'resistance-breakout',
          strength: zone.count >= 3 ? 'strong' : 'medium'
        });
      }
      
      // Support breakout (sell signal)
      if (zone.type === 'support' && 
          prevClose > zone.level && 
          currentClose < zone.level * 0.995) { // 0.5% confirmation
        
        signals.push({
          type: 'sell',
          price: currentClose,
          timestamp,
          created_at: now,
          indicator: 'support-breakout',
          strength: zone.count >= 3 ? 'strong' : 'medium'
        });
      }
    }
  }
  
  return signals;
}

module.exports = {
  detectSignals,
  findPivotPoints,
  groupPivotLevels
};
