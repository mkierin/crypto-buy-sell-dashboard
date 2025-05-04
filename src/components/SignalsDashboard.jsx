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

  // Get signal color based on type
  const getSignalColor = (type) => {
    return type === 'buy' ? 'green' : 'red';
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
              Last updated: {lastUpdated.toLocaleString()}
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
      
      <div className="timeframes-grid">
        {timeframes.map(timeframe => {
          const timeframeSignals = signalsMap[timeframe] || [];
          const filteredSignals = filterSignalsBySymbol(timeframeSignals);
          
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
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSignals.map((signal, index) => (
                      <tr key={index} className={`signal-row ${signal.type}`}>
                        <td>{signal.symbol}</td>
                        <td style={{ color: getSignalColor(signal.type) }}>
                          {signal.type.toUpperCase()}
                        </td>
                        <td>${signal.price.toFixed(2)}</td>
                        <td>{formatDate(signal.timestamp)}</td>
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
