import React, { useEffect, useState } from 'react';
import { fetchRecentSignals, fetchTimeframes, fetchSignals } from '../api/signals';
import '../styles/signals.css';
import '../styles/cluster-modal.css';

export default function SignalsDashboard() {
  const [timeframes, setTimeframes] = useState([]);
  const [signalsMap, setSignalsMap] = useState({});
  const [allSignals, setAllSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedSymbol, setSelectedSymbol] = useState('all');
  const [signalCounts, setSignalCounts] = useState({ buy: 0, sell: 0 });
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [showClusterInfo, setShowClusterInfo] = useState(false);

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
      if (strength === 'strong') return '#00e676'; // strong green
      if (strength === 'weak') return '#b9f6ca'; // weak green
      return '#00c853'; // medium green
    } else if (type === 'sell') {
      if (strength === 'strong') return '#ff1744'; // strong red
      if (strength === 'weak') return '#ff8a80'; // weak red
      return '#ff5252'; // medium red
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
    
    // Specific icons based on indicator type
    if (indicator === 'wavetrend-crossover' || indicator === 'wavetrend+rsi') {
      return type === 'buy' ? '⚡↑' : '⚡↓'; // lightning for wavetrend
    } else if (indicator === 'golden-cross' || indicator === 'death-cross' || indicator === 'ema-crossover') {
      return type === 'buy' ? '✖↑' : '✖↓'; // X for crossovers
    } else if (indicator === 'rsi-oversold' || indicator === 'rsi-overbought' || indicator === 'rsi-divergence') {
      return type === 'buy' ? '⟲↑' : '⟲↓'; // cycle for RSI
    } else if (indicator === 'resistance-breakout' || indicator === 'support-breakout') {
      return type === 'buy' ? '⊥↑' : '⊤↓'; // breakout symbols
    }
    
    // Default icons
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
      
      // Filter by selected symbol if needed
      const relevantSignals = filterSignalsBySymbol(buySellSignals);
      
      // For each symbol, prioritize cluster signals
      const symbolMap = {};
      relevantSignals.forEach(signal => {
        if (!symbolMap[signal.symbol]) {
          symbolMap[signal.symbol] = signal;
        } else if (signal.indicator === 'cluster' && symbolMap[signal.symbol].indicator !== 'cluster') {
          symbolMap[signal.symbol] = signal;
        } else if (signal.strength === 'strong' && symbolMap[signal.symbol].strength !== 'strong' && 
                  symbolMap[signal.symbol].indicator !== 'cluster') {
          symbolMap[signal.symbol] = signal;
        }
      });
      
      // Process the prioritized signals
      Object.values(symbolMap).forEach(signal => {
        if (!symbolGroups[signal.symbol]) {
          symbolGroups[signal.symbol] = {
            symbol: signal.symbol,
            buyTimeframes: [],
            sellTimeframes: [],
            lastSignal: null,
            signalType: null,
            signalStrength: 0
          };
        }
        
        const group = symbolGroups[signal.symbol];
        
        // Track which timeframes have buy/sell signals
        if (signal.type === 'buy' && !group.buyTimeframes.includes(timeframe)) {
          group.buyTimeframes.push(timeframe);
        } else if (signal.type === 'sell' && !group.sellTimeframes.includes(timeframe)) {
          group.sellTimeframes.push(timeframe);
        }
        
        // Update last signal if this one is more recent or is a cluster
        if (!group.lastSignal || 
            signal.indicator === 'cluster' && group.lastSignal.indicator !== 'cluster' ||
            signal.timestamp > group.lastSignal.timestamp) {
          group.lastSignal = signal;
        }
      });
    });
    
    // Determine dominant signal type for each symbol
    Object.values(symbolGroups).forEach(group => {
      if (group.buyTimeframes.length > group.sellTimeframes.length) {
        group.signalType = 'buy';
        group.signalStrength = group.buyTimeframes.length;
      } else {
        group.signalType = 'sell';
        group.signalStrength = group.sellTimeframes.length;
      }
    });
    
    // Convert to array and sort by signal strength (descending)
    return Object.values(symbolGroups)
      .filter(group => group.signalStrength > 1) // Only show if signal appears in multiple timeframes
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
    if (!allSignals || allSignals.length === 0) return ['all'];
    return ['all', ...new Set(allSignals.map(signal => signal.symbol))];
  };
  
  // Filter signals by selected symbol
  const filterSignalsBySymbol = (signals) => {
    if (!signals || selectedSymbol === 'all') return signals;
    return signals.filter(signal => signal.symbol === selectedSymbol);
  };
  
  // Consolidate signals to show only one per symbol
  const consolidateSignals = (signals) => {
    if (!signals || signals.length === 0) return [];
    
    // Group signals by symbol
    const symbolGroups = {};
    
    signals.forEach(signal => {
      if (!symbolGroups[signal.symbol]) {
        symbolGroups[signal.symbol] = [];
      }
      symbolGroups[signal.symbol].push(signal);
    });
    
    // For each symbol, prioritize cluster signals, then strong signals, then most recent
    return Object.values(symbolGroups).map(group => {
      // First look for cluster signals
      const clusterSignal = group.find(s => s.indicator === 'cluster');
      if (clusterSignal) return clusterSignal;
      
      // Then look for strong signals
      const strongSignal = group.find(s => s.strength === 'strong');
      if (strongSignal) return strongSignal;
      
      // Otherwise return the most recent signal
      return group.sort((a, b) => b.timestamp - a.timestamp)[0];
    });
  };
  
  // Handle cluster click to show details
  const handleClusterClick = (signal) => {
    setSelectedCluster(signal);
    setShowClusterInfo(true);
  };
  
  // Close cluster info modal
  const closeClusterInfo = () => {
    setShowClusterInfo(false);
    setSelectedCluster(null);
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
          const filteredBySymbol = filterSignalsBySymbol(buySellSignals);
          // Consolidate to show only one signal per symbol
          const filteredSignals = consolidateSignals(filteredBySymbol);
          
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
                      <th>Signal</th>
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
                              title={`${signal.indicator.toUpperCase()} | Strength: ${signal.strength || 'medium'}${signal.meta ? ` | Details: ${JSON.stringify(signal.meta)}` : ''}`}
                              onClick={signal.indicator === 'cluster' ? () => handleClusterClick(signal) : undefined}
                            >
                              {signal.indicator === 'cluster' ? 'CLUSTER' : 
                               signal.indicator.length > 10 ? signal.indicator.substring(0, 8) + '...' : signal.indicator}
                              {signal.meta && signal.meta.count && (
                                <span className="meta-count"> ({signal.meta.count})</span>
                              )}
                              {signal.indicator === 'cluster' && (
                                <span className="info-icon"> ℹ️</span>
                              )}
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
      
      {/* Cluster Info Modal */}
      {showClusterInfo && selectedCluster && (
        <div className="cluster-info-modal">
          <div className="cluster-info-content">
            <div className="cluster-info-header">
              <h3>{selectedCluster.symbol} Cluster Details</h3>
              <button className="close-button" onClick={closeClusterInfo}>×</button>
            </div>
            <div className="cluster-info-body">
              <div className="cluster-info-row">
                <span className="info-label">Type:</span>
                <span className="info-value" style={{ color: getSignalColor(selectedCluster.type, 'strong') }}>
                  {selectedCluster.type.toUpperCase()}
                </span>
              </div>
              <div className="cluster-info-row">
                <span className="info-label">Strength:</span>
                <span className="info-value">{selectedCluster.strength}</span>
              </div>
              <div className="cluster-info-row">
                <span className="info-label">Price:</span>
                <span className="info-value">${selectedCluster.price.toFixed(2)}</span>
              </div>
              <div className="cluster-info-row">
                <span className="info-label">Time:</span>
                <span className="info-value">{formatDate(selectedCluster.timestamp)}</span>
              </div>
              {selectedCluster.meta && (
                <>
                  <div className="cluster-info-row">
                    <span className="info-label">Signal Count:</span>
                    <span className="info-value">{selectedCluster.meta.count}</span>
                  </div>
                  {selectedCluster.meta.indicators && (
                    <div className="cluster-info-row">
                      <span className="info-label">Indicators:</span>
                      <div className="indicators-list">
                        {selectedCluster.meta.indicators.map((indicator, i) => (
                          <span key={i} className="cluster-indicator-item">{indicator}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              <div className="cluster-info-description">
                <p>This cluster represents multiple {selectedCluster.type} signals occurring close together, 
                indicating a {selectedCluster.type === 'buy' ? 'strong bullish' : 'strong bearish'} momentum.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
