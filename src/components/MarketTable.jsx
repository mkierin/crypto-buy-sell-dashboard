import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { getWavetrendSignal, formatSignalAgo } from '../utils/wavetrend';
import MiniChart from './MiniChart.jsx';

// Helper to format numbers as currency
function formatUSD(num) {
  if (typeof num !== 'number') return '-';
  return '$' + num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// Helper to format percentages
function formatPct(num) {
  if (typeof num !== 'number') return '-';
  return num.toFixed(2) + '%';
}


export default function MarketTable({ data, klinesMap, interval }) {
  const [expandedId, setExpandedId] = useState(null);
  if (!Array.isArray(data) || data.length === 0) return <div>No data</div>;
  const now = new Date();

  return (
    <div className="market-table-container">
      <table className="market-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Symbol</th>
            <th>Price</th>
            <th>Market Cap</th>
            <th>24h %</th>
            <th>Volume</th>
            <th>Signal</th>
          </tr>
        </thead>
        <tbody>
          {data.map((coin, i) => {
            const klines = klinesMap?.[coin.id] || [];
            const { signal, triggeredAt } = getWavetrendSignal(klines, interval);
            const ago = triggeredAt ? formatSignalAgo(triggeredAt, now, interval) : '';
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
                  <td>
                    {signal ? (
                      <span style={{
                        background: signal === 'Buy' ? '#00e1b4' : '#ff3860',
                        color: '#181a20',
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontWeight: 600
                      }}>
                        {signal} {ago && <span style={{ fontWeight: 400, color: '#eee', marginLeft: 4 }}>{ago}</span>}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={8} style={{ background: '#23263a', padding: 0 }}>
                      <MiniChart klines={klines} signal={signal} triggeredAt={triggeredAt} />
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
