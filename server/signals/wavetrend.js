// WaveTrend signal detection algorithm
// Based on the ASR EzAlgo indicator

/**
 * Calculate EMA (Exponential Moving Average)
 * @param {Array} prices - Array of price values
 * @param {Number} period - EMA period
 * @returns {Array} - Array of EMA values
 */
function calculateEMA(prices, period) {
  const k = 2 / (period + 1);
  const ema = [prices[0]];
  
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i-1] * (1-k));
  }
  
  return ema;
}

/**
 * Calculate WaveTrend oscillator
 * @param {Array} data - Array of price data (OHLC)
 * @param {Number} channelLength - Channel length
 * @param {Number} avgLength - Average length
 * @returns {Array} - Array of [wt1, wt2] values
 */
function calculateWaveTrend(data, channelLength = 13, avgLength = 21) {
  // Extract HLC3 values
  const hlc3 = data.map(candle => {
    const [timestamp, open, high, low, close] = candle;
    return (parseFloat(high) + parseFloat(low) + parseFloat(close)) / 3;
  });
  
  // Calculate WaveTrend components
  const esa = calculateEMA(hlc3, channelLength);
  const d = calculateEMA(
    hlc3.map((value, i) => Math.abs(value - esa[i])),
    channelLength
  );
  
  const ci = hlc3.map((value, i) => 
    (value - esa[i]) / (0.015 * d[i])
  );
  
  const wt1 = calculateEMA(ci, avgLength);
  const wt2 = [];
  
  // Calculate wt2 (Simple Moving Average of wt1)
  for (let i = 0; i < wt1.length; i++) {
    if (i < 2) {
      wt2.push(wt1[i]);
    } else {
      wt2.push((wt1[i] + wt1[i-1] + wt1[i-2]) / 3);
    }
  }
  
  return [wt1, wt2];
}

/**
 * Calculate RSI (Relative Strength Index)
 * @param {Array} data - Array of price data
 * @param {Number} period - RSI period
 * @returns {Array} - Array of RSI values
 */
function calculateRSI(data, period = 21) {
  // Extract HLC3 values
  const hlc3 = data.map(candle => {
    const [timestamp, open, high, low, close] = candle;
    return (parseFloat(high) + parseFloat(low) + parseFloat(close)) / 3;
  });
  
  const changes = [];
  for (let i = 1; i < hlc3.length; i++) {
    changes.push(hlc3[i] - hlc3[i-1]);
  }
  
  const gains = changes.map(change => change > 0 ? change : 0);
  const losses = changes.map(change => change < 0 ? -change : 0);
  
  const avgGain = [];
  const avgLoss = [];
  
  // First average gain and loss
  let gainSum = 0;
  let lossSum = 0;
  
  for (let i = 0; i < period; i++) {
    gainSum += gains[i];
    lossSum += losses[i];
  }
  
  avgGain.push(gainSum / period);
  avgLoss.push(lossSum / period);
  
  // Calculate subsequent values
  for (let i = period; i < changes.length; i++) {
    avgGain.push((avgGain[avgGain.length-1] * (period-1) + gains[i]) / period);
    avgLoss.push((avgLoss[avgLoss.length-1] * (period-1) + losses[i]) / period);
  }
  
  // Calculate RS and RSI
  const rsi = [];
  for (let i = 0; i < avgGain.length; i++) {
    const rs = avgGain[i] / (avgLoss[i] === 0 ? 0.001 : avgLoss[i]);
    rsi.push(100 - (100 / (1 + rs)));
  }
  
  return rsi;
}

/**
 * Detect signals based on WaveTrend crossovers and RSI conditions
 * @param {Array} klines - Array of klines data from Binance
 * @returns {Array} - Array of signal objects
 */
function detectSignals(klines) {
  if (!klines || klines.length < 50) {
    return [];
  }
  
  const signals = [];
  const now = Date.now();
  
  // Calculate WaveTrend
  const [wt1, wt2] = calculateWaveTrend(klines);
  
  // Calculate RSI
  const rsi = calculateRSI(klines);
  const rsiEma = calculateEMA(rsi, 13);
  
  // Detect signals for the last 10 candles
  for (let i = Math.max(21, 3); i < klines.length; i++) {
    const candle = klines[i];
    const timestamp = parseInt(candle[0]);
    const price = parseFloat(candle[4]); // Close price
    
    // Adjust indices for the indicators
    const wtIndex = i - 3; // Offset for wt calculation
    const rsiIndex = i - 22; // Offset for rsi calculation
    
    if (wtIndex < 0 || rsiIndex < 0) continue;
    
    // Check for RSI conditions to enhance signal strength
    const isOversold = rsiIndex >= 0 && rsi[rsiIndex] < 30 && rsi[rsiIndex] < rsiEma[rsiIndex];
    const isOverbought = rsiIndex >= 0 && rsi[rsiIndex] > 70 && rsi[rsiIndex] > rsiEma[rsiIndex];
    
    // Simple buy signal: Any WaveTrend crossover (to ensure we have signals)
    if (wt1[wtIndex-1] <= wt2[wtIndex-1] && wt1[wtIndex] > wt2[wtIndex]) {
      signals.push({
        type: 'buy',
        price,
        timestamp,
        created_at: now,
        indicator: 'wavetrend-crossover',
        strength: 'medium'
      });
    }
    
    // Buy signal: WaveTrend crossover and wt2 <= -40 (reduced from -55 to be more sensitive)
    if (wt1[wtIndex-1] <= wt2[wtIndex-1] && wt1[wtIndex] > wt2[wtIndex] && wt2[wtIndex] <= -40) {
      // Enhanced buy signal if also oversold
      const strength = isOversold ? 'strong' : 'medium';
      const context = isOversold ? 'wavetrend+rsi' : 'wavetrend';
      
      signals.push({
        type: 'buy',
        price,
        timestamp,
        created_at: now,
        indicator: context,
        strength: strength
      });
    }
    
    // Simple sell signal: Any WaveTrend crossunder (to ensure we have signals)
    if (wt1[wtIndex-1] >= wt2[wtIndex-1] && wt1[wtIndex] < wt2[wtIndex]) {
      signals.push({
        type: 'sell',
        price,
        timestamp,
        created_at: now,
        indicator: 'wavetrend-crossover',
        strength: 'medium'
      });
    }
    
    // Sell signal: WaveTrend crossunder and wt2 >= 40 (reduced from 55 to be more sensitive)
    if (wt1[wtIndex-1] >= wt2[wtIndex-1] && wt1[wtIndex] < wt2[wtIndex] && wt2[wtIndex] >= 40) {
      // Enhanced sell signal if also overbought
      const strength = isOverbought ? 'strong' : 'medium';
      const context = isOverbought ? 'wavetrend+rsi' : 'wavetrend';
      
      signals.push({
        type: 'sell',
        price,
        timestamp,
        created_at: now,
        indicator: context,
        strength: strength
      });
    }
  }
  
  // Detect cluster signals (multiple signals close together)
  const clusterSignals = detectClusterSignals(signals, klines);
  return [...signals, ...clusterSignals];
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
  
  // Check for buy clusters (3 or more buy signals within 5 candles)
  if (buySignals.length >= 3) {
    // Sort by timestamp
    buySignals.sort((a, b) => a.timestamp - b.timestamp);
    
    for (let i = 0; i < buySignals.length - 2; i++) {
      const signal1 = buySignals[i];
      const signal3 = buySignals[i + 2];
      
      // Check if these 3 signals are within 5 candles of each other
      const timeDiff = signal3.timestamp - signal1.timestamp;
      const candlePeriod = getCandlePeriodMs(klines);
      
      if (timeDiff <= candlePeriod * 5) {
        // This is a cluster of buy signals
        clusterSignals.push({
          type: 'buy',
          price: signal3.price, // Use the latest price
          timestamp: signal3.timestamp,
          created_at: now,
          indicator: 'cluster',
          strength: 'strong'
        });
        
        // Skip to avoid overlapping clusters
        i += 2;
      }
    }
  }
  
  // Check for sell clusters (3 or more sell signals within 5 candles)
  if (sellSignals.length >= 3) {
    // Sort by timestamp
    sellSignals.sort((a, b) => a.timestamp - b.timestamp);
    
    for (let i = 0; i < sellSignals.length - 2; i++) {
      const signal1 = sellSignals[i];
      const signal3 = sellSignals[i + 2];
      
      // Check if these 3 signals are within 5 candles of each other
      const timeDiff = signal3.timestamp - signal1.timestamp;
      const candlePeriod = getCandlePeriodMs(klines);
      
      if (timeDiff <= candlePeriod * 5) {
        // This is a cluster of sell signals
        clusterSignals.push({
          type: 'sell',
          price: signal3.price, // Use the latest price
          timestamp: signal3.timestamp,
          created_at: now,
          indicator: 'cluster',
          strength: 'strong'
        });
        
        // Skip to avoid overlapping clusters
        i += 2;
      }
    }
  }
  
  return clusterSignals;
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
  detectSignals,
  calculateWaveTrend,
  calculateRSI,
  detectClusterSignals
};
