import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { formatSignalAgo } from '../utils/wavetrend';
import { formatUSD, formatPct, formatNumber } from '../utils/format';
import { getSignals } from '../utils/signals';
import MiniChart from './MiniChart.jsx';

export default function MarketTable({ data, klinesMap, interval, fundingMap, oiMap }) {
  const [expandedId, setExpandedId] = useState(null);
  const [sortKey, setSortKey] = useState('market_cap_rank');
  const [sortDir, setSortDir] = useState('asc');
  const [signalFilter, setSignalFilter] = useState({ buy: true, sell: true });
  const [signalSort, setSignalSort] = useState('time'); // 'time', 'pct', or 'signal'
  
  // Load saved active signals from localStorage or use default
  const [activeSignals, setActiveSignals] = useState(() => {
    const savedSignals = localStorage.getItem('cryptoDashboard_activeSignals');
    return savedSignals ? JSON.parse(savedSignals) : ['wavetrend'];
  });
  
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // Save active signals to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('cryptoDashboard_activeSignals', JSON.stringify(activeSignals));
  }, [activeSignals]);

  // Signal mode descriptions
  const signalModeDescriptions = {
    wavetrend: 'Wavetrend: Buy/Sell when Wavetrend oscillator crosses WT2 in extreme zones (-60/+60). Good for reversals.',
    rsi: 'RSI: Buy/Sell when RSI crosses above 30 or below 70. Classic momentum strategy.',
    ema: 'EMA: Buy/Sell when price crosses above/below EMA21. Trend following.',
    confluence: 'Confluence: WT and RSI must agree on signal direction.',
    wt_ema: 'WT+EMA: Wavetrend signal confirmed by EMA trend. Reduces false signals by requiring trend agreement.',
    rsi_ema: 'RSI+EMA: RSI signal confirmed by EMA trend.',
    wt_rsi: 'WT+RSI: Both Wavetrend and RSI agree within 3 candles.',
    cluster: 'Cluster: At least two of WT, RSI, EMA agree on Buy/Sell.'
  };
  const signalModes = [
    { value: 'wavetrend', label: 'Wavetrend' },
    { value: 'rsi', label: 'RSI' },
    { value: 'ema', label: 'EMA' },
    { value: 'confluence', label: 'Confluence (WT+RSI)' },
    { value: 'wt_ema', label: 'WT + EMA' },
    { value: 'rsi_ema', label: 'RSI + EMA' },
    { value: 'wt_rsi', label: 'WT + RSI' },
    { value: 'cluster', label: 'Cluster (2 of 3)' }
  ];
  if (!Array.isArray(data) || data.length === 0) return <div>No data</div>;
  const now = new Date();

  // Helper: Calculate volume change % from klines
  function getVolumeChange(klines) {
    if (!klines || klines.length < 2) return null;
    const prev = Number(klines[klines.length - 2]?.[5]);
    const curr = Number(klines[klines.length - 1]?.[5]);
    if (!prev || !curr) return null;
    return ((curr - prev) / prev) * 100;
  }

  // Compose table rows with all derived fields for sorting/filtering
  const rows = data.map((coin) => {
    const klines = klinesMap?.[coin.id] || [];
    const signals = getSignals(klines);
    const { wavetrend, rsi, ema } = signals;
    let mainSignal, mainTriggeredAt;
    if (activeSignals[0] === 'confluence') {
      mainSignal = wavetrend.signal === rsi.signal && wavetrend.signal ? wavetrend.signal : null;
      mainTriggeredAt = wavetrend.signal === rsi.signal && wavetrend.signal ? wavetrend.triggeredAt : null;
    } else {
      mainSignal = signals[activeSignals[0]]?.signal;
      mainTriggeredAt = signals[activeSignals[0]]?.triggeredAt;
    }
    const ago = mainTriggeredAt ? formatSignalAgo(mainTriggeredAt, now, interval) : '';
    const funding = fundingMap?.[coin.id]?.lastFundingRate;
    const oiArr = oiMap?.[coin.id] || [];
    const oi = oiArr.length > 0 ? oiArr[oiArr.length - 1]?.sumOpenInterest : null;
    const volChange = getVolumeChange(klines);
    return {
      coin,
      klines,
      signals,
      mainSignal,
      mainTriggeredAt,
      ago,
      funding,
      oi,
      volChange,
    };
  });

  // Filtering for Signal column
  let filteredRows = rows;
  if (!signalFilter.buy || !signalFilter.sell) {
    filteredRows = rows.filter(r => {
      if (signalFilter.buy && r.mainSignal === 'Buy') return true;
      if (signalFilter.sell && r.mainSignal === 'Sell') return true;
      return false;
    });
  }

  // Sorting logic
  const sortFns = {
    market_cap_rank: r => r.coin.market_cap_rank,
    name: r => r.coin.name.toLowerCase(),
    price: r => r.coin.current_price,
    change_24h: r => r.coin.price_change_percentage_24h,
    volume: r => r.volChange,
    funding: r => r.funding || 0,
    oi: r => r.oi || 0
  };
  
  // Add dynamic sort functions for each signal
  activeSignals.forEach(sig => {
    // Sort by signal type (Buy/Sell)
    sortFns[`${sig}_signal`] = r => {
      const signal = r.signals[sig]?.signal;
      return signal === 'Buy' ? 1 : signal === 'Sell' ? -1 : 0;
    };
    
    // Sort by percentage change
    sortFns[`${sig}_pct`] = r => {
      return r.signals[sig]?.pctChange || 0;
    };
    
    // Sort by time since triggered
    sortFns[`${sig}_time`] = r => {
      return r.signals[sig]?.triggeredAt ? -r.signals[sig].triggeredAt.getTime() : 0;
    };
  });

  // Apply sorting
  const sortFn = sortFns[sortKey] || sortFns.market_cap_rank;
  const sortedRows = [...filteredRows].sort((a, b) => {
    const aVal = sortFn(a);
    const bVal = sortFn(b);
    if (aVal === bVal) return 0;
    const dir = sortDir === 'asc' ? 1 : -1;
    return aVal > bVal ? dir : -dir;
  });

  // Handle sorting clicks
  function handleSort(key) {
    if (key === sortKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }
  
  // Handle signal column sorting with multiple sort options
  function handleSignalSort(sig, type) {
    const key = `${sig}_${type}`;
    handleSort(key);
  }

  // Sort indicator
  function sortIcon(key) {
    if (sortKey !== key) return null;
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  }

  // Signal settings button
  const settingsButton = (
    <button onClick={(e) => { e.stopPropagation(); setSettingsOpen(true); }} style={{ background: 'none', border: 'none', color: '#aaa', marginLeft: 'auto', cursor: 'pointer', fontSize: 18 }}>⚙️</button>
  );

  // Signal settings modal
  const signalSettingsUI = (
    settingsOpen && (
      <div style={{
        position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh', zIndex: 1000,
        background: 'rgba(10,12,24,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center'
      }} onClick={() => setSettingsOpen(false)}>
        <div style={{
          background: '#23263a', color: '#eee', borderRadius: 14, minWidth: 320, maxWidth: 400, padding: 32,
          boxShadow: '0 6px 32px #000b', border: '1.5px solid #444', position: 'relative', fontSize: 16
        }} onClick={e => e.stopPropagation()}>
          <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 12, letterSpacing: 0.5 }}>Signal Settings</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {signalModes.map(opt => (
              <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderRadius: 8, padding: '6px 10px', background: activeSignals.includes(opt.value) ? '#00e1b41a' : 'transparent', fontWeight: activeSignals.includes(opt.value) ? 700 : 500 }}>
                <input type="checkbox" name="signalMode" value={opt.value} checked={activeSignals.includes(opt.value)} onChange={e => {
                  setActiveSignals(prev => e.target.checked ? [...prev, opt.value] : prev.filter(v => v !== opt.value));
                }} style={{ accentColor: '#00e1b4', marginRight: 6 }} />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
          <div style={{ marginTop: 18, fontSize: 14, color: '#aaa', fontStyle: 'italic' }}>
            {activeSignals.length === 1 ? signalModeDescriptions[activeSignals[0]] : 'Select one or more signals to show columns.'}
          </div>
          <button onClick={() => setSettingsOpen(false)} style={{ position: 'absolute', top: 10, right: 16, background: 'none', border: 'none', color: '#eee', fontSize: 22, cursor: 'pointer' }}>&times;</button>
        </div>
      </div>
    )
  );

  // Signal column filter UI
  const signalFilterUI = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{ color: '#eee' }}>Signal:</span>
      <label style={{ color: '#00e1b4' }}>
        <input type="checkbox" checked={signalFilter.buy} onChange={e => setSignalFilter(f => ({ ...f, buy: e.target.checked }))} /> Buy
      </label>
      <label style={{ color: '#ff3860' }}>
        <input type="checkbox" checked={signalFilter.sell} onChange={e => setSignalFilter(f => ({ ...f, sell: e.target.checked }))} /> Sell
      </label>
    </div>
  );

  // Format the last updated time
  const lastUpdatedTime = new Date().toLocaleTimeString();
  const lastUpdatedDate = new Date().toLocaleDateString();
  
  return (
    <div>
      {signalFilterUI}
      {signalSettingsUI}
      <table style={{ 
        width: '100%', 
        borderCollapse: 'collapse', 
        fontSize: 14,
        borderSpacing: 0,
        border: 'none',
        tableLayout: 'fixed',
        background: '#13151f'
      }}>
        <thead>
          <tr style={{ background: '#171923' }}>
            <th 
              onClick={() => handleSort('name')}
              style={{ 
                display: 'flex', 
                alignItems: 'center',
                padding: '10px 12px',
                borderBottom: '1px solid #1a1c25',
                borderRight: '1px solid #1a1c25',
                cursor: 'pointer',
                width: '200px',
                fontWeight: 500,
                color: '#eee'
              }}
            >
              Coin {sortIcon('name')}
              {settingsButton}
            </th>
            <th 
              onClick={() => handleSort('price')}
              style={{ 
                padding: '10px 12px', 
                borderBottom: '1px solid #1a1c25',
                cursor: 'pointer',
                width: '100px',
                fontWeight: 500,
                color: '#eee',
                textAlign: 'center'
              }}
            >
              Price {sortIcon('price')}
            </th>
            <th 
              onClick={() => handleSort('change_24h')}
              style={{ 
                padding: '10px 12px', 
                borderBottom: '1px solid #1a1c25',
                cursor: 'pointer',
                width: '80px',
                fontWeight: 500,
                color: '#eee',
                textAlign: 'center'
              }}
            >
              24h % {sortIcon('change_24h')}
            </th>
            <th 
              onClick={() => handleSort('volume')}
              style={{ 
                padding: '10px 12px', 
                borderBottom: '1px solid #1a1c25',
                cursor: 'pointer',
                width: '80px',
                fontWeight: 500,
                color: '#eee',
                textAlign: 'center'
              }}
            >
              Volume % {sortIcon('volume')}
            </th>
            <th 
              onClick={() => handleSort('funding')}
              style={{ 
                padding: '10px 12px', 
                borderBottom: '1px solid #1a1c25',
                cursor: 'pointer',
                width: '80px',
                fontWeight: 500,
                color: '#eee',
                textAlign: 'center'
              }}
            >
              Funding {sortIcon('funding')}
            </th>
            <th 
              onClick={() => handleSort('oi')}
              style={{ 
                padding: '10px 12px', 
                borderBottom: '1px solid #1a1c25',
                cursor: 'pointer',
                width: '100px',
                fontWeight: 500,
                color: '#eee',
                textAlign: 'center'
              }}
            >
              OI {sortIcon('oi')}
            </th>
            {activeSignals.map(sig => (
              <th 
                key={sig}
                onClick={() => handleSignalSort(sig, 'signal')}
                style={{ 
                  padding: '10px 12px', 
                  borderBottom: '1px solid #1a1c25',
                  cursor: 'pointer',
                  fontWeight: 500,
                  color: '#eee',
                  textAlign: 'center'
                }}
              >
                {signalModes.find(m => m.value === sig)?.label || sig} {sortKey.startsWith(sig) ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, i) => {
            const { coin, klines, signals, mainSignal, mainTriggeredAt, ago, funding, oi, volChange } = row;
            const isExpanded = expandedId === coin.id;
            return (
              <React.Fragment key={coin.id}>
                <tr
                  onClick={() => setExpandedId(isExpanded ? null : coin.id)}
                  style={{ 
                    cursor: 'pointer', 
                    background: isExpanded ? '#23263a' : i % 2 === 0 ? '#1c1e2a' : '#20222e',
                  }}
                >
                  <td style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 12, 
                    padding: '16px 12px',
                    borderBottom: '1px solid #1a1c25',
                    width: '200px'
                  }}>
                    <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={coin.image} alt={coin.name} style={{ width: 26, height: 26, borderRadius: 13 }} />
                    </div>
                    <span style={{ fontWeight: 500, fontSize: 16 }}>{coin.name}</span>
                  </td>
                  <td style={{ 
                    padding: '16px 12px',
                    borderBottom: '1px solid #1a1c25',
                    textAlign: 'center',
                    fontWeight: 500
                  }}>{formatUSD(coin.current_price)}</td>
                  <td style={{ 
                    color: coin.price_change_percentage_24h >= 0 ? '#00e1b4' : '#ff3860',
                    padding: '16px 12px',
                    borderBottom: '1px solid #1a1c25',
                    textAlign: 'center',
                    fontWeight: 500
                  }}>
                    {formatPct(coin.price_change_percentage_24h)}
                  </td>
                  <td style={{ 
                    color: volChange > 0 ? '#00e1b4' : '#ff3860',
                    padding: '16px 12px',
                    borderBottom: '1px solid #1a1c25',
                    textAlign: 'center',
                    fontWeight: 500
                  }}>{volChange !== null ? formatPct(volChange, 2) : '-'}</td>
                  <td style={{ 
                    padding: '16px 12px',
                    borderBottom: '1px solid #1a1c25',
                    textAlign: 'center',
                    fontWeight: 500
                  }}>{funding !== undefined ? formatPct(Number(funding) * 100, 4) : '-'}</td>
                  <td style={{ 
                    padding: '16px 12px',
                    borderBottom: '1px solid #1a1c25',
                    textAlign: 'center',
                    fontWeight: 500
                  }}>{oi !== undefined && oi !== null ? formatNumber(Number(oi), 0) : '-'}</td>
                  {activeSignals.map(sig => {
                    const sigObj = signals[sig];
                    return (
                      <td key={sig} style={{ 
                        padding: 0,
                        borderBottom: '1px solid #1a1c25'
                      }}>
                        {sigObj && sigObj.signal ? (
                          <div style={{
                            width: '100%',
                            minHeight: 52,
                            background: '#13151f',
                            borderLeft: `4px solid ${sigObj.signal === 'Buy' ? '#00e1b4' : '#ff3860'}`,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            padding: '8px 10px',
                            position: 'relative',
                            overflow: 'visible',
                          }}>
                            {/* Subtle gradient overlay */}
                            <div style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: '30%',
                              background: `linear-gradient(90deg, ${sigObj.signal === 'Buy' ? 'rgba(0,225,180,0.12)' : 'rgba(255,56,96,0.12)'} 0%, transparent 100%)`,
                              pointerEvents: 'none',
                            }} />
                            
                            {/* Signal type (Buy/Sell) */}
                            <div style={{ 
                              fontSize: 14, 
                              fontWeight: 700, 
                              color: sigObj.signal === 'Buy' ? '#00e1b4' : '#ff3860',
                              marginBottom: 4,
                              whiteSpace: 'nowrap',
                            }}>
                              {sigObj.signal}
                            </div>
                            
                            {/* Percentage and time on same line */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              width: '100%',
                            }}>
                              {sigObj.pctChange !== null && (
                                <span style={{
                                  fontSize: 13,
                                  fontWeight: 600,
                                  // For Buy signals: green if positive, red if negative
                                  // For Sell signals: green if negative (successful), red if positive (failed)
                                  color: (sigObj.signal === 'Buy' && sigObj.pctChange > 0) || 
                                         (sigObj.signal === 'Sell' && sigObj.pctChange < 0) ? 
                                         '#00e1b4' : '#ff3860',
                                  whiteSpace: 'nowrap',
                                }}>
                                  {(sigObj.pctChange > 0 ? '+' : '') + sigObj.pctChange.toFixed(2) + '%'}
                                </span>
                              )}
                              
                              {sigObj.triggeredAt && (
                                <span style={{ 
                                  fontSize: 12, 
                                  color: '#aaa', 
                                  fontWeight: 400,
                                  whiteSpace: 'nowrap',
                                  marginLeft: 8,
                                }}>
                                  {formatSignalAgo(sigObj.triggeredAt, now, interval)}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span style={{ 
                            color: '#888', 
                            fontWeight: 400, 
                            fontSize: 16,
                            display: 'block',
                            padding: '16px 12px'
                          }}>-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={8 + activeSignals.length} style={{ 
                      background: '#1a1c25', 
                      padding: 0,
                      borderBottom: '1px solid #1a1c25'
                    }}>
                      <MiniChart klines={klines} signals={{ ...signals, activeSignals }} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      
      {/* Last updated timestamp */}
      <div style={{ 
        marginTop: 16, 
        fontSize: 12, 
        color: '#aaa', 
        display: 'flex',
        justifyContent: 'space-between',
        padding: '0 4px'
      }}>
        <span>Last updated: {lastUpdatedTime} on {lastUpdatedDate}</span>
        <span>Interval: {interval}</span>
      </div>
    </div>
  );
}

MarketTable.propTypes = {
  data: PropTypes.array,
  klinesMap: PropTypes.object,
  interval: PropTypes.string,
  fundingMap: PropTypes.object,
  oiMap: PropTypes.object
};
