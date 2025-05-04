import React, { useEffect, useState } from 'react';
import { fetchRecentSignals, fetchTimeframes, fetchSignals } from '../api/signals';
import '../styles/signals.css';

export default function SignalsDashboard() {
  const [timeframes, setTimeframes] = useState([]);
  const [signalsMap, setSignalsMap] = useState({});
  const [allSignals, setAllSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedSymbol, setSelectedSymbol] = useState('all');
  const [signalCounts, setSignalCounts] = useState({ buy: 0, sell: 0 });

  useEffect(() => {
    // Fetch supported timeframes once
    async function fetchSupportedTimeframes() {
      const frames = await fetchTimeframes();
      setTimeframes(frames);
    }
    
    fetchSupportedTimeframes();
  }, []);

  useEffect(() => {
    let timer;
    let cancelled = false;
    
    async function fetchSignalsData() {
      setLoading(true);
      try {
        // Get recent signals per timeframe
        const signals = await fetchRecentSignals(5);
        
        // Get all signals for the summary
        const allSignalsData = await fetchSignals({ limit: 50 });
        
        if (!cancelled) {
          setSignalsMap(signals);
          setAllSignals(allSignalsData);
          
          // Calculate signal counts
          const buys = allSignalsData.filter(s => s.type === 'buy').length;
          const sells = allSignalsData.filter(s => s.type === 'sell').length;
          setSignalCounts({ buy: buys, sell: sells });
          
          setLastUpdated(new Date());
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching signals:', error);
        if (!cancelled) setLoading(false);
      }
    }
    
    fetchSignalsData();
    
    // Set up auto-refresh
    timer = setInterval(fetchSignalsData, refreshInterval * 1000);
    
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [refreshInterval, selectedSymbol]);

  // Format timestamp to readable date
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Get signal color based on type and strength
  const getSignalColor = (type, strength = 'medium', indicator = '') => {
    // Special color for cluster signals
    if (indicator === 'cluster') {
      return type === 'buy' ? '#00ff00' : '#ff0000'; // bright green/red for clusters
    }
    
    if (type === 'buy') {
      return strength === 'strong' ? '#00e676' : '#00c853'; // stronger/normal green
    } else if (type === 'sell') {
      return strength === 'strong' ? '#ff1744' : '#ff5252'; // stronger/normal red
    } else {
      return '#787b86'; // gray for other types
    }
  };
  
  // Get signal icon based on type and indicator
  const getSignalIcon = (type, indicator = '') => {
    // Special icon for cluster signals
    if (indicator === 'cluster') {
      return type === 'buy' ? '▲▲▲' : '▼▼▼'; // triple triangles for clusters
    }
    
    if (type === 'buy') {
      return indicator.includes('+') ? '⇧' : '↑'; // double up arrow for combined signals, single for normal
    } else if (type === 'sell') {
      return indicator.includes('+') ? '⇩' : '↓'; // double down arrow for combined signals, single for normal
    } else {
      return '•'; // bullet for other types
    }
  };
  
  // Filter signals to only show buy and sell
  const filterBuySellSignals = (signals) => {
    if (!signals) return [];
    return signals.filter(signal => signal.type === 'buy' || signal.type === 'sell');
  };
  
  // Get combined signals across timeframes
  const getCombinedSignals = () => {
    // Group signals by symbol
    const symbolGroups = {};
    
    // Process each timeframe
    Object.entries(signalsMap).forEach(([timeframe, signals]) => {
      if (!signals) return;
      
      // Only consider buy/sell signals
      const buySellSignals = filterBuySellSignals(signals);
      
      buySellSignals.forEach(signal => {
        if (!symbolGroups[signal.symbol]) {
          symbolGroups[signal.symbol] = { buy: 0, sell: 0, timeframes: {}, lastSignal: null };
        }
        
        // Count by type
        symbolGroups[signal.symbol][signal.type]++;
        
        // Track timeframes with this signal type
        if (!symbolGroups[signal.symbol].timeframes[signal.type]) {
          symbolGroups[signal.symbol].timeframes[signal.type] = [];
        }
        
        if (!symbolGroups[signal.symbol].timeframes[signal.type].includes(timeframe)) {
          symbolGroups[signal.symbol].timeframes[signal.type].push(timeframe);
        }
        
        // Track the most recent signal
        if (!symbolGroups[signal.symbol].lastSignal || 
            signal.timestamp > symbolGroups[signal.symbol].lastSignal.timestamp) {
          symbolGroups[signal.symbol].lastSignal = signal;
        }
      });
    });
    
    // Convert to array and sort by strength (number of timeframes with same signal)
    return Object.entries(symbolGroups)
      .map(([symbol, data]) => ({
        symbol,
        buyCount: data.buy,
        sellCount: data.sell,
        buyTimeframes: data.timeframes.buy || [],
        sellTimeframes: data.timeframes.sell || [],
        lastSignal: data.lastSignal,
        // Determine overall signal direction
        signalStrength: Math.max(data.buyTimeframes?.length || 0, data.sellTimeframes?.length || 0),
        signalType: (data.buyTimeframes?.length || 0) > (data.sellTimeframes?.length || 0) ? 'buy' : 'sell'
      }))
      .sort((a, b) => b.signalStrength - a.signalStrength);
  };

  // Handle refresh interval change
  const handleRefreshChange = (e) => {
    setRefreshInterval(parseInt(e.target.value));
  };
  
  // Handle symbol filter change
  const handleSymbolChange = (e) => {
    setSelectedSymbol(e.target.value);
  };
  
  // Get unique symbols from all signals
  const getUniqueSymbols = () => {
    if (!allSignals || allSignals.length === 0) return [];
    return ['all', ...new Set(allSignals.map(signal => signal.symbol))];
  };
  
  // Filter signals by selected symbol
  const filterSignalsBySymbol = (signals) => {
    if (!signals) return [];
    if (selectedSymbol === 'all') return signals;
    return signals.filter(signal => signal.symbol === selectedSymbol);
  };

  const combinedSignals = getCombinedSignals();

  return (
    <div className="signals-dashboard">
      <div className="signals-header">
        <h1>Recent Buy/Sell Signals</h1>
        <div className="signals-controls">
          <label>
            Symbol: 
            <select value={selectedSymbol} onChange={handleSymbolChange}>
              {getUniqueSymbols().map(symbol => (
                <option key={symbol} value={symbol}>
                  {symbol === 'all' ? 'All Symbols' : symbol}
                </option>
              ))}
            </select>
          </label>
          <label>
            Auto-refresh: 
            <select value={refreshInterval} onChange={handleRefreshChange}>
              <option value="10">10 seconds</option>
              <option value="30">30 seconds</option>
              <option value="60">1 minute</option>
              <option value="300">5 minutes</option>
            </select>
          </label>
          {lastUpdated && (
            <div className="last-updated">
              Last updated: {formatDate(lastUpdated)}
            </div>
          )}
        </div>
      </div>

      {loading && <div className="signals-loading">Loading signals data...</div>}
      
      {!loading && (
        <div className="signals-summary">
          <div className="summary-card">
            <h3>Signal Summary</h3>
            <div className="summary-stats">
              <div className="stat-item">
                <span className="stat-label">Total Signals:</span>
                <span className="stat-value">{allSignals.length}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Buy Signals:</span>
                <span className="stat-value buy">{signalCounts.buy}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Sell Signals:</span>
                <span className="stat-value sell">{signalCounts.sell}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Buy/Sell Ratio:</span>
                <span className="stat-value">
                  {signalCounts.sell > 0 ? (signalCounts.buy / signalCounts.sell).toFixed(2) : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Combined Signals Section */}
      <div className="combined-signals-section">
        <h2>Multi-Timeframe Signals</h2>
        {combinedSignals.length > 0 ? (
          <table className="signals-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Signal</th>
                <th>Strength</th>
                <th>Timeframes</th>
                <th>Price</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {combinedSignals.map((signal) => (
                <tr key={signal.symbol} className={`signal-row ${signal.signalType} ${signal.lastSignal.indicator === 'cluster' ? 'cluster-signal' : ''}`}>
                  <td>{signal.symbol}</td>
                  <td style={{ color: getSignalColor(signal.signalType, 'strong') }}>
                    <span className="signal-icon">{getSignalIcon(signal.signalType, 'combined')}</span>
                    {signal.signalType.toUpperCase()}
                  </td>
                  <td>{signal.signalStrength} timeframes</td>
                  <td>
                    {signal.signalType === 'buy' 
                      ? signal.buyTimeframes.join(', ')
                      : signal.sellTimeframes.join(', ')}
                  </td>
                  <td>${signal.lastSignal.price.toFixed(2)}</td>
                  <td>{formatDate(signal.lastSignal.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="no-signals">No combined signals found</div>
        )}
      </div>
      
      <div className="timeframes-grid">
        {timeframes.map(timeframe => {
          const timeframeSignals = signalsMap[timeframe] || [];
          // Filter to only buy/sell signals
          const buySellSignals = filterBuySellSignals(timeframeSignals);
          const filteredSignals = filterSignalsBySymbol(buySellSignals);
          
          return (
            <div key={timeframe} className="timeframe-card">
              <h2>{timeframe} Timeframe</h2>
              {filteredSignals.length > 0 ? (
                <table className="signals-table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Type</th>
                      <th>Price</th>
                      <th>Time</th>
                      <th>Indicator</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSignals.map((signal, index) => (
                      <tr key={index} className={`signal-row ${signal.type} ${signal.indicator === 'cluster' ? 'cluster-signal' : ''}`}>
                        <td>{signal.symbol}</td>
                        <td style={{ color: getSignalColor(signal.type, signal.strength) }}>
                          <span className="signal-icon">{getSignalIcon(signal.type, signal.indicator)}</span>
                          {signal.type.toUpperCase()}
                        </td>
                        <td>${signal.price.toFixed(2)}</td>
                        <td>{formatDate(signal.timestamp)}</td>
                        <td className="signal-indicator">
                          {signal.indicator && (
                            <span 
                              className={`indicator-badge ${signal.indicator === 'cluster' ? 'cluster' : ''}`} 
                              title={`Strength: ${signal.strength || 'medium'}`}
                            >
                              {signal.indicator}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="no-signals">
                  {selectedSymbol !== 'all' 
                    ? `No recent signals for ${selectedSymbol} in this timeframe` 
                    : 'No recent signals for this timeframe'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
