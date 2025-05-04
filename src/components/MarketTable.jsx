import React, { useState, useEffect, memo } from 'react';
import PropTypes from 'prop-types';
import { formatSignalAgo } from '../utils/wavetrend';
import { formatUSD, formatPct, formatNumber } from '../utils/format';
import { getSignals } from '../utils/signals';
import MiniChart from './MiniChart.jsx';

function MarketTable({ data, klinesMap, interval, fundingMap, oiMap }) {
  const [expandedId, setExpandedId] = useState(null);
  const [sortKey, setSortKey] = useState('market_cap_rank');
  const [sortDir, setSortDir] = useState('asc');
  const [signalFilter, setSignalFilter] = useState({ buy: true, sell: true });

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
    // const { wavetrend, rsi } = signals; // Uncomment if needed later
    const funding = fundingMap?.[coin.id]?.lastFundingRate;
    const oiArr = oiMap?.[coin.id] || [];
    const oi = oiArr.length > 0 ? oiArr[oiArr.length - 1]?.sumOpenInterest : null;
    const volChange = getVolumeChange(klines);

    // Volume spike detection for latest candle
    let hasVolumeSpike = false, volSpikeValue = null;
    if (klines.length > 20) {
      const prev = klines.slice(-21, -1);
      const avgVol = prev.reduce((a, k) => a + Number(k[5]), 0) / 20;
      const vol = Number(klines[klines.length - 1][5]);
      if (avgVol > 0 && vol > 2 * avgVol) {
        hasVolumeSpike = true;
        volSpikeValue = vol;
      }
    }

    return {
      coin,
      klines,
      signals,
      funding,
      oi,
      volChange,
      hasVolumeSpike,
      volSpikeValue,
    };
  });

  // Filtering for Signal column
  let filteredRows = rows;
  if (!signalFilter.buy || !signalFilter.sell) {
    filteredRows = rows.filter(r => {
      // Use the currently active signal for filtering
      const sig = activeSignals[0];
      if (signalFilter.buy && r.signals[sig]?.signal === 'Buy') return true;
      if (signalFilter.sell && r.signals[sig]?.signal === 'Sell') return true;
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#eee' }}>Signal:</span>
        <label style={{ color: '#00e1b4' }}>
          <input type="checkbox" checked={signalFilter.buy} onChange={e => setSignalFilter(f => ({ ...f, buy: e.target.checked }))} /> Buy
        </label>
        <label style={{ color: '#ff3860' }}>
          <input type="checkbox" checked={signalFilter.sell} onChange={e => setSignalFilter(f => ({ ...f, sell: e.target.checked }))} /> Sell
        </label>
      </div>
      <div>{settingsButton}</div>
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
            <th 
              style={{ 
                padding: '10px 12px', 
                borderBottom: '1px solid #1a1c25',
                cursor: 'pointer',
                fontWeight: 500,
                color: '#b266ff',
                textAlign: 'center'
              }}
            >
              Vol Spike
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, i) => {
            const { coin, klines, signals, funding, oi, volChange, hasVolumeSpike, volSpikeValue } = row;
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
                    gap: 10, 
                    padding: '10px 12px',
                    borderBottom: '1px solid #1a1c25',
                    width: '200px'
                  }}>
                    <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={coin.image} alt={coin.name} style={{ width: 22, height: 22, borderRadius: 11 }} />
                    </div>
                    <span style={{ fontWeight: 500, fontSize: 15 }}>{coin.name}</span>
                  </td>
                  <td style={{ 
                    padding: '10px 12px',
                    borderBottom: '1px solid #1a1c25',
                    textAlign: 'center',
                    fontWeight: 500
                  }}>{formatUSD(coin.current_price)}</td>
                  <td style={{ 
                    color: coin.price_change_percentage_24h >= 0 ? '#00e1b4' : '#ff3860',
                    padding: '10px 12px',
                    borderBottom: '1px solid #1a1c25',
                    textAlign: 'center',
                    fontWeight: 500
                  }}>
                    {formatPct(coin.price_change_percentage_24h)}
                  </td>
                  <td style={{ 
                    color: volChange > 0 ? '#00e1b4' : '#ff3860',
                    padding: '10px 12px',
                    borderBottom: '1px solid #1a1c25',
                    textAlign: 'center',
                    fontWeight: 500
                  }}>{volChange !== null ? formatPct(volChange, 2) : '-'}</td>
                  <td style={{ 
                    padding: '10px 12px',
                    borderBottom: '1px solid #1a1c25',
                    textAlign: 'center',
                    fontWeight: 500
                  }}>{funding !== undefined ? formatPct(Number(funding) * 100, 4) : '-'}</td>
                  <td style={{ 
                    padding: '10px 12px',
                    borderBottom: '1px solid #1a1c25',
                    textAlign: 'center',
                    fontWeight: 500
                  }}>{oi !== undefined && oi !== null ? formatNumber(Number(oi), 0) : '-'}</td>
                  {activeSignals.map(sig => (
                    <td key={sig} style={{
                      padding: 0,
                      borderBottom: '1px solid #1a1c25',
                      background: '#191b23',
                      minWidth: 82,
                      textAlign: 'center',
                      fontWeight: 600,
                      fontSize: 15
                    }}>
                      {signals[sig] && signals[sig].signal ? (
                        <div style={{
                          width: '100%',
                          minHeight: 42,
                          background: '#13151f',
                          borderLeft: `4px solid ${signals[sig].signal === 'Buy' ? '#00e1b4' : '#ff3860'}`,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          padding: '6px 10px',
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
                            background: `linear-gradient(90deg, ${signals[sig].signal === 'Buy' ? 'rgba(0,225,180,0.12)' : 'rgba(255,56,96,0.12)'} 0%, transparent 100%)`,
                            pointerEvents: 'none',
                          }} />
                          
                          {/* Signal type (Buy/Sell) */}
                          <div style={{ 
                            fontSize: 13, 
                            fontWeight: 700, 
                            color: signals[sig].signal === 'Buy' ? '#00e1b4' : '#ff3860',
                            marginBottom: 3,
                            whiteSpace: 'nowrap',
                          }}>
                            {signals[sig].signal}
                          </div>
                          {/* Percentage and time on same line */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                          }}>
                            {signals[sig].pctChange !== null && (
                              <span style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: (signals[sig].signal === 'Buy' && signals[sig].pctChange > 0) ||
                                       (signals[sig].signal === 'Sell' && signals[sig].pctChange < 0)
                                ? '#00e1b4' : '#ff3860',
                                whiteSpace: 'nowrap',
                              }}>
                                {(signals[sig].pctChange > 0 ? '+' : '') + signals[sig].pctChange.toFixed(2) + '%'}
                              </span>
                            )}
                            {signals[sig].triggeredAt && (
                              <span style={{
                                fontSize: 11,
                                color: '#aaa',
                                fontWeight: 400,
                                whiteSpace: 'nowrap',
                                marginLeft: 8,
                              }}>
                                {formatSignalAgo(signals[sig].triggeredAt, now, interval)}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span style={{
                          color: '#888',
                          fontWeight: 400,
                          fontSize: 14,
                          display: 'block',
                          padding: '10px 12px'
                        }}>-</span>
                      )}
                    </td>
                  ))}
                  <td style={{
                    background: '#191b23',
                    border: 'none',
                    minWidth: 64,
                    textAlign: 'center',
                    fontWeight: 700,
                    fontSize: 16,
                    color: hasVolumeSpike ? '#b266ff' : '#888',
                    padding: 0
                  }}>
                    {hasVolumeSpike ? (
                      <span title={volSpikeValue ? `Vol: ${volSpikeValue.toLocaleString()}` : ''}>
                        <svg width="18" height="18" style={{ verticalAlign: 'middle', marginBottom: 2 }}>
                          <rect x="4" y="4" width="10" height="10" fill="#b266ff" stroke="#fff" strokeWidth="2" transform="rotate(45 9 9)" />
                        </svg>
                      </span>
                    ) : (
                      <span style={{ color: '#888', fontSize: 15 }}>-</span>
                    )}
                  </td>
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

// Export with memo to prevent unnecessary rerenders
export default memo(MarketTable, (prevProps, nextProps) => {
  // Only rerender if the interval changes or if the data structure changes
  const intervalChanged = prevProps.interval !== nextProps.interval;
  const dataChanged = prevProps.data !== nextProps.data;
  
  // For klines, only check if the structure changed, not the content
  // This prevents rerenders when only the values inside klines change
  const klinesStructureChanged = 
    Object.keys(prevProps.klinesMap || {}).length !== Object.keys(nextProps.klinesMap || {}).length;
  
  // Return true if props are equal (no rerender needed)
  return !intervalChanged && !dataChanged && !klinesStructureChanged;
});
