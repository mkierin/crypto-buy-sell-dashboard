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
  const [signalMode, setSignalMode] = useState('wavetrend');
  const [showWavetrend, setShowWavetrend] = useState(true);
  const [showRSI, setShowRSI] = useState(false);
  const [showEMA, setShowEMA] = useState(false);
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
    const mainSignal = signalMode === 'confluence'
      ? (wavetrend.signal === rsi.signal && wavetrend.signal ? wavetrend.signal : null)
      : signals[signalMode]?.signal;
    const mainTriggeredAt = signalMode === 'confluence'
      ? (wavetrend.signal === rsi.signal && wavetrend.signal ? wavetrend.triggeredAt : null)
      : signals[signalMode]?.triggeredAt;
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
      if (signalFilter.buy && r.signal === 'Buy') return true;
      if (signalFilter.sell && r.signal === 'Sell') return true;
      return false;
    });
  }

  // Sorting logic
  const sortFns = {
    market_cap_rank: r => r.coin.market_cap_rank,
    name: r => r.coin.name.toLowerCase(),
    symbol: r => r.coin.symbol.toUpperCase(),
    current_price: r => r.coin.current_price,
    market_cap: r => r.coin.market_cap,
    price_change_percentage_24h: r => r.coin.price_change_percentage_24h,
    total_volume: r => r.coin.total_volume,
    volChange: r => r.volChange ?? -Infinity,
    funding: r => r.funding !== undefined ? Number(r.funding) : -Infinity,
    oi: r => r.oi !== undefined && r.oi !== null ? Number(r.oi) : -Infinity,
    signal: r => r.signal || '',
    signal_time: r => r.triggeredAt ? r.triggeredAt.getTime() : 0,
  };
  let sortedRows = [...filteredRows];
  if (sortKey === 'signal') {
    // Special: sort by signal (Buy first, Sell second) or by signal time
    if (signalFilter.buy && !signalFilter.sell) {
      sortedRows = sortedRows.filter(r => r.signal === 'Buy');
    } else if (!signalFilter.buy && signalFilter.sell) {
      sortedRows = sortedRows.filter(r => r.signal === 'Sell');
    }
    if (signalSort === 'signal') {
      sortedRows.sort((a, b) => {
        // Buy first, then Sell, then none
        const order = { Buy: 0, Sell: 1, '': 2 };
        return (order[a.signal] - order[b.signal]) * (sortDir === 'asc' ? 1 : -1);
      });
    } else {
      sortedRows.sort((a, b) => ((b.triggeredAt?.getTime() || 0) - (a.triggeredAt?.getTime() || 0)) * (sortDir === 'asc' ? -1 : 1));
    }
  } else if (sortFns[sortKey]) {
    sortedRows.sort((a, b) => {
      const vA = sortFns[sortKey](a);
      const vB = sortFns[sortKey](b);
      if (vA === vB) return 0;
      return (vA > vB ? 1 : -1) * (sortDir === 'asc' ? 1 : -1);
    });
  }

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

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
      <span style={{ color: '#eee', marginLeft: 12 }}>Sort by:</span>
      <select value={signalSort} onChange={e => setSignalSort(e.target.value)} style={{ background: '#23263a', color: '#eee', border: 'none', borderRadius: 4 }}>
        <option value="time">Time</option>
        <option value="signal">Signal Type</option>
      </select>
    </div>
  );

  function sortIcon(key) {
    if (sortKey !== key) return <span style={{ color: '#444', marginLeft: 4 }}>↕</span>;
    return sortDir === 'asc' ? <span style={{ color: '#00e1b4', marginLeft: 4 }}>▲</span> : <span style={{ color: '#ff3860', marginLeft: 4 }}>▼</span>;
  }

  // --- Signal mode and column toggles UI ---
  const signalModeUI = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
      <span style={{ color: '#eee' }}>Signal Mode:</span>
      <select value={signalMode} onChange={e => setSignalMode(e.target.value)} style={{ background: '#23263a', color: '#eee', border: 'none', borderRadius: 4 }}>
        <option value="wavetrend">Wavetrend</option>
        <option value="rsi">RSI</option>
        <option value="ema">EMA</option>
        <option value="confluence">Confluence</option>
      </select>
      <label style={{ color: '#00e1b4' }}>
        <input type="checkbox" checked={showWavetrend} onChange={e => setShowWavetrend(e.target.checked)} /> WT
      </label>
      <label style={{ color: '#f3c900' }}>
        <input type="checkbox" checked={showRSI} onChange={e => setShowRSI(e.target.checked)} /> RSI
      </label>
      <label style={{ color: '#e91e63' }}>
        <input type="checkbox" checked={showEMA} onChange={e => setShowEMA(e.target.checked)} /> EMA
      </label>
    </div>
  );

  return (
    <div className="market-table-container">
      {signalModeUI}
      {signalFilterUI}
      <table className="market-table">
        <thead>
          <tr>
            <th style={{ cursor: 'pointer' }} onClick={() => handleSort('market_cap_rank')}># {sortIcon('market_cap_rank')}</th>
            <th style={{ cursor: 'pointer' }} onClick={() => handleSort('name')}>Name {sortIcon('name')}</th>
            <th style={{ cursor: 'pointer' }} onClick={() => handleSort('symbol')}>Symbol {sortIcon('symbol')}</th>
            <th style={{ cursor: 'pointer' }} onClick={() => handleSort('current_price')}>Price {sortIcon('current_price')}</th>
            <th style={{ cursor: 'pointer' }} onClick={() => handleSort('market_cap')}>Market Cap {sortIcon('market_cap')}</th>
            <th style={{ cursor: 'pointer' }} onClick={() => handleSort('price_change_percentage_24h')}>24h % {sortIcon('price_change_percentage_24h')}</th>
            <th style={{ cursor: 'pointer' }} onClick={() => handleSort('total_volume')}>Volume {sortIcon('total_volume')}</th>
            <th style={{ cursor: 'pointer' }} onClick={() => handleSort('volChange')}>Vol Δ% {sortIcon('volChange')}</th>
            <th style={{ cursor: 'pointer' }} onClick={() => handleSort('funding')}>Funding {sortIcon('funding')}</th>
            <th style={{ cursor: 'pointer' }} onClick={() => handleSort('oi')}>OI {sortIcon('oi')}</th>
            {showWavetrend && <th>WT Signal</th>}
            {showRSI && <th>RSI Signal</th>}
            {showEMA && <th>EMA Signal</th>}
            <th style={{ cursor: 'pointer' }} onClick={() => { setSortKey('signal'); setSortDir('desc'); }}>Signal {sortIcon('signal')}</th>
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
                  <td>{coin.market_cap_rank}</td>
                  <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img src={coin.image} alt={coin.name} style={{ width: 20, height: 20, borderRadius: 10 }} />
                    {coin.name}
                  </td>
                  <td>{coin.symbol.toUpperCase()}</td>
                  <td>{formatUSD(coin.current_price)}</td>
                  <td>{formatUSD(coin.market_cap)}</td>
                  <td style={{ color: coin.price_change_percentage_24h >= 0 ? '#00e1b4' : '#ff3860' }}>
                    {formatPct(coin.price_change_percentage_24h)}
                  </td>
                  <td>{formatUSD(coin.total_volume)}</td>
                  <td style={{ color: volChange > 0 ? '#00e1b4' : '#ff3860' }}>{volChange !== null ? formatPct(volChange, 2) : '-'}</td>
                  <td>{funding !== undefined ? formatPct(Number(funding) * 100, 4) : '-'}</td>
                  <td>{oi !== undefined && oi !== null ? formatNumber(Number(oi), 0) : '-'}</td>
                  {showWavetrend && <td>{signals.wavetrend.signal ? `${signals.wavetrend.signal} ${signals.wavetrend.triggeredAt ? formatSignalAgo(signals.wavetrend.triggeredAt, now, interval) : ''}` : '-'}</td>}
                  {showRSI && <td>{signals.rsi.signal ? `${signals.rsi.signal} ${signals.rsi.triggeredAt ? formatSignalAgo(signals.rsi.triggeredAt, now, interval) : ''}` : '-'}</td>}
                  {showEMA && <td>{signals.ema.signal ? `${signals.ema.signal} ${signals.ema.triggeredAt ? formatSignalAgo(signals.ema.triggeredAt, now, interval) : ''}` : '-'}</td>}
                  <td>
                    {mainSignal ? (
                      <span style={{
                        background: mainSignal === 'Buy' ? '#00e1b4' : '#ff3860',
                        color: '#181a20',
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontWeight: 600
                      }}>
                        {mainSignal} {ago && <span style={{ fontWeight: 400, color: '#eee', marginLeft: 4 }}>{ago}</span>}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={11 + (showWavetrend ? 1 : 0) + (showRSI ? 1 : 0) + (showEMA ? 1 : 0) + 1} style={{ background: '#23263a', padding: 0 }}>
                      <MiniChart klines={klines} signals={signals} signal={mainSignal} triggeredAt={mainTriggeredAt} />
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
  interval: PropTypes.string
};
