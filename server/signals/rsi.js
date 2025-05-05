// RSI signal detection algorithm
// Detects overbought/oversold conditions and divergences

/**
 * Calculate RSI (Relative Strength Index)
 * @param {Array} data - Array of price data
 * @param {Number} period - RSI period
 * @returns {Array} - Array of RSI values
 */
function calculateRSI(data, period = 14) {
  // Extract close values
  const closes = data.map(candle => {
    const [timestamp, open, high, low, close] = candle;
    return parseFloat(close);
  });
  
  const changes = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i-1]);
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
 * Check for RSI divergence
 * @param {Array} prices - Array of close prices
 * @param {Array} rsi - Array of RSI values
 * @param {Number} lookback - Number of candles to look back
 * @returns {Object} - Divergence information or null if none found
 */
function checkDivergence(prices, rsi, lookback = 5) {
  // Need at least lookback+1 candles
  if (prices.length < lookback + 1 || rsi.length < lookback + 1) {
    return null;
  }
  
  const currentIndex = prices.length - 1;
  
  // Check for bullish divergence (price makes lower low but RSI makes higher low)
  // This is a buy signal
  if (prices[currentIndex] < prices[currentIndex - lookback] && 
      rsi[rsi.length - 1] > rsi[rsi.length - 1 - lookback]) {
    return {
      type: 'bullish',
      strength: rsi[rsi.length - 1] < 40 ? 'strong' : 'medium'
    };
  }
  
  // Check for bearish divergence (price makes higher high but RSI makes lower high)
  // This is a sell signal
  if (prices[currentIndex] > prices[currentIndex - lookback] && 
      rsi[rsi.length - 1] < rsi[rsi.length - 1 - lookback]) {
    return {
      type: 'bearish',
      strength: rsi[rsi.length - 1] > 60 ? 'strong' : 'medium'
    };
  }
  
  return null;
}

/**
 * Detect signals based on RSI conditions
 * @param {Array} klines - Array of klines data from Binance
 * @returns {Array} - Array of signal objects
 */
function detectSignals(klines) {
  if (!klines || klines.length < 50) {
    return [];
  }
  
  const signals = [];
  const now = Date.now();
  
  // Extract close prices
  const closes = klines.map(candle => parseFloat(candle[4]));
  
  // Calculate RSI with different periods
  const rsi14 = calculateRSI(klines, 14);
  const rsi7 = calculateRSI(klines, 7);
  
  // Calculate RSI EMAs
  const rsi14Ema = calculateEMA(rsi14, 9);
  
  // Detect signals for the last 10 candles
  for (let i = Math.max(30, 14); i < klines.length; i++) {
    const candle = klines[i];
    const timestamp = parseInt(candle[0]);
    const price = parseFloat(candle[4]); // Close price
    
    // Adjust indices for the indicators
    const rsiIndex = i - 15; // Offset for rsi calculation
    
    if (rsiIndex < 0) continue;
    
    // RSI Oversold (Buy signal)
    if (rsi14[rsiIndex] < 30 && rsi14[rsiIndex-1] < 30 && rsi14[rsiIndex] > rsi14[rsiIndex-1]) {
      signals.push({
        type: 'buy',
        price,
        timestamp,
        created_at: now,
        indicator: 'rsi-oversold',
        strength: rsi14[rsiIndex] < 20 ? 'strong' : 'medium'
      });
    }
    
    // RSI Overbought (Sell signal)
    if (rsi14[rsiIndex] > 70 && rsi14[rsiIndex-1] > 70 && rsi14[rsiIndex] < rsi14[rsiIndex-1]) {
      signals.push({
        type: 'sell',
        price,
        timestamp,
        created_at: now,
        indicator: 'rsi-overbought',
        strength: rsi14[rsiIndex] > 80 ? 'strong' : 'medium'
      });
    }
    
    // RSI Crossover EMA (Buy signal)
    if (rsi14[rsiIndex-1] < rsi14Ema[rsiIndex-1] && rsi14[rsiIndex] > rsi14Ema[rsiIndex] && rsi14[rsiIndex] < 50) {
      signals.push({
        type: 'buy',
        price,
        timestamp,
        created_at: now,
        indicator: 'rsi-crossover',
        strength: 'medium'
      });
    }
    
    // RSI Crossunder EMA (Sell signal)
    if (rsi14[rsiIndex-1] > rsi14Ema[rsiIndex-1] && rsi14[rsiIndex] < rsi14Ema[rsiIndex] && rsi14[rsiIndex] > 50) {
      signals.push({
        type: 'sell',
        price,
        timestamp,
        created_at: now,
        indicator: 'rsi-crossover',
        strength: 'medium'
      });
    }
    
    // Check for RSI divergence
    const divergence = checkDivergence(closes.slice(0, i+1), rsi14, 5);
    if (divergence) {
      signals.push({
        type: divergence.type === 'bullish' ? 'buy' : 'sell',
        price,
        timestamp,
        created_at: now,
        indicator: 'rsi-divergence',
        strength: divergence.strength
      });
    }
  }
  
  return signals;
}

module.exports = {
  detectSignals,
  calculateRSI,
  calculateEMA
};
