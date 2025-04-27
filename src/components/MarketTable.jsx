import React, { useState } from 'react';
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
  const [signalSort, setSignalSort] = useState('time'); // 'time' or 'signal'
  const [activeSignals, setActiveSignals] = useState(['wavetrend']);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
    oi: r => r.oi || 0,
    signal: r => {
      if (signalSort === 'time') {
        return r.mainTriggeredAt ? -r.mainTriggeredAt.getTime() : 0;
      } else {
        return r.mainSignal === 'Buy' ? 1 : r.mainSignal === 'Sell' ? -1 : 0;
      }
    }
  };

  // Apply sorting
  const sortFn = sortFns[sortKey] || sortFns.market_cap_rank;
  const sortedRows = [...filteredRows].sort((a, b) => {
    const aVal = sortFn(a);
    const bVal = sortFn(b);
    if (aVal === bVal) return 0;
    const dir = sortDir === 'asc' ? 1 : -1;
    return aVal > bVal ? dir : -dir;
  });

  function handleSort(key) {
    if (key === sortKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
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

  return (
    <div>
      {signalFilterUI}
      {signalSettingsUI}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr>
            <th style={{ display: 'flex', alignItems: 'center' }}>
              Coin
              {settingsButton}
            </th>
            <th>Price</th>
            <th>24h %</th>
            <th>Volume %</th>
            <th>Funding</th>
            <th>OI</th>
            {activeSignals.map(sig => (
              <th key={sig}>{signalModes.find(m => m.value === sig)?.label || sig}</th>
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
                  style={{ cursor: 'pointer', background: isExpanded ? '#23263a' : undefined }}
                >
                  <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img src={coin.image} alt={coin.name} style={{ width: 20, height: 20, borderRadius: 10 }} />
                    {coin.name}
                  </td>
                  <td>{formatUSD(coin.current_price)}</td>
                  <td style={{ color: coin.price_change_percentage_24h >= 0 ? '#00e1b4' : '#ff3860' }}>
                    {formatPct(coin.price_change_percentage_24h)}
                  </td>
                  <td style={{ color: volChange > 0 ? '#00e1b4' : '#ff3860' }}>{volChange !== null ? formatPct(volChange, 2) : '-'}</td>
                  <td>{funding !== undefined ? formatPct(Number(funding) * 100, 4) : '-'}</td>
                  <td>{oi !== undefined && oi !== null ? formatNumber(Number(oi), 0) : '-'}</td>
                  {activeSignals.map(sig => {
                    const sigObj = signals[sig];
                    return (
                      <td key={sig} style={{ padding: 0 }}>
                        {sigObj && sigObj.signal ? (
                          <div style={{
                            width: '100%',
                            height: 36,
                            background: '#1c1e2a',
                            borderLeft: `4px solid ${sigObj.signal === 'Buy' ? '#00e1b4' : '#ff3860'}`,
                            borderRadius: 4,
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0 10px',
                            position: 'relative',
                            overflow: 'hidden',
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
                            
                            <span style={{ 
                              fontSize: 14, 
                              fontWeight: 700, 
                              color: sigObj.signal === 'Buy' ? '#00e1b4' : '#ff3860',
                              marginRight: 'auto',
                            }}>
                              {sigObj.signal}
                            </span>
                            
                            {sigObj.pctChange !== null && (
                              <span style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: sigObj.pctChange > 0 ? '#00e1b4' : '#ff3860',
                                marginRight: 8,
                              }}>
                                {(sigObj.pctChange > 0 ? '+' : '') + sigObj.pctChange.toFixed(2) + '%'}
                              </span>
                            )}
                            
                            {sigObj.triggeredAt && (
                              <span style={{ 
                                fontSize: 12, 
                                color: '#aaa', 
                                fontWeight: 400,
                              }}>
                                {formatSignalAgo(sigObj.triggeredAt, now, interval)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#888', fontWeight: 400, fontSize: 14 }}>-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={8 + activeSignals.length} style={{ background: '#23263a', padding: 0 }}>
                      <MiniChart klines={klines} signals={{ ...signals, activeSignals }} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
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
