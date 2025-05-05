// Moving Average Crossover signal detection algorithm
// Detects golden cross and death cross patterns

/**
 * Calculate Simple Moving Average (SMA)
 * @param {Array} prices - Array of price values
 * @param {Number} period - SMA period
 * @returns {Array} - Array of SMA values
 */
function calculateSMA(prices, period) {
  const sma = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      sma.push(null); // Not enough data yet
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += prices[i - j];
      }
      sma.push(sum / period);
    }
  }
  return sma;
}

/**
 * Calculate Exponential Moving Average (EMA)
 * @param {Array} prices - Array of price values
 * @param {Number} period - EMA period
 * @returns {Array} - Array of EMA values
 */
function calculateEMA(prices, period) {
  if (prices.length < period) {
    return Array(prices.length).fill(null);
  }
  
  const k = 2 / (period + 1);
  
  // Start with SMA for the first EMA value
  let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
  const result = Array(period - 1).fill(null);
  result.push(ema);
  
  // Calculate EMA for the rest of the prices
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
    result.push(ema);
  }
  
  return result;
}

/**
 * Detect signals based on Moving Average crossovers
 * @param {Array} klines - Array of klines data from Binance
 * @returns {Array} - Array of signal objects
 */
function detectSignals(klines) {
  if (!klines || klines.length < 100) {
    return [];
  }
  
  const signals = [];
  const now = Date.now();
  
  // Extract close prices
  const closes = klines.map(candle => parseFloat(candle[4]));
  
  // Calculate various moving averages
  const sma50 = calculateSMA(closes, 50);
  const sma200 = calculateSMA(closes, 200);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  
  // Detect signals for the last 10 candles (but not the most recent one which might not be complete)
  for (let i = Math.max(200, 1); i < klines.length; i++) {
    const candle = klines[i];
    const timestamp = parseInt(candle[0]);
    const price = parseFloat(candle[4]); // Close price
    
    // Golden Cross (SMA 50 crosses above SMA 200) - Strong buy signal
    if (i > 200 && 
        sma50[i-1] <= sma200[i-1] && 
        sma50[i] > sma200[i]) {
      signals.push({
        type: 'buy',
        price,
        timestamp,
        created_at: now,
        indicator: 'golden-cross',
        strength: 'strong'
      });
    }
    
    // Death Cross (SMA 50 crosses below SMA 200) - Strong sell signal
    if (i > 200 && 
        sma50[i-1] >= sma200[i-1] && 
        sma50[i] < sma200[i]) {
      signals.push({
        type: 'sell',
        price,
        timestamp,
        created_at: now,
        indicator: 'death-cross',
        strength: 'strong'
      });
    }
    
    // EMA 20 crosses above EMA 50 - Medium buy signal
    if (i > 50 && 
        ema20[i-1] <= ema50[i-1] && 
        ema20[i] > ema50[i]) {
      signals.push({
        type: 'buy',
        price,
        timestamp,
        created_at: now,
        indicator: 'ema-crossover',
        strength: 'medium'
      });
    }
    
    // EMA 20 crosses below EMA 50 - Medium sell signal
    if (i > 50 && 
        ema20[i-1] >= ema50[i-1] && 
        ema20[i] < ema50[i]) {
      signals.push({
        type: 'sell',
        price,
        timestamp,
        created_at: now,
        indicator: 'ema-crossover',
        strength: 'medium'
      });
    }
    
    // Price crosses above EMA 20 - Weak buy signal
    if (i > 20 && 
        parseFloat(klines[i-1][4]) <= ema20[i-1] && 
        price > ema20[i]) {
      signals.push({
        type: 'buy',
        price,
        timestamp,
        created_at: now,
        indicator: 'price-ema-cross',
        strength: 'weak'
      });
    }
    
    // Price crosses below EMA 20 - Weak sell signal
    if (i > 20 && 
        parseFloat(klines[i-1][4]) >= ema20[i-1] && 
        price < ema20[i]) {
      signals.push({
        type: 'sell',
        price,
        timestamp,
        created_at: now,
        indicator: 'price-ema-cross',
        strength: 'weak'
      });
    }
  }
  
  return signals;
}

module.exports = {
  detectSignals,
  calculateSMA,
  calculateEMA
};
