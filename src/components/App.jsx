import React, { useEffect, useState } from 'react';
import { fetchMarketData } from '../api/coingecko';
import { fetchKlines } from '../api/binance';
import MarketTable from './MarketTable.jsx';
import IntervalDropdown from './IntervalDropdown.jsx';
import '../styles/app.css';

export default function App() {
  const [cgData, setCgData] = useState(null);
  const [klinesMap, setKlinesMap] = useState({}); // { symbol: klines[] }
  const [interval, setInterval] = useState('1h');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getData() {
      setLoading(true);
      // Fetch CoinGecko market data for top 20 coins
      const cg = await fetchMarketData();
      setCgData(cg);
      // Fetch klines for each coin (Binance symbol = UPPERCASE+USDT)
      const klinesObj = {};
      if (cg && Array.isArray(cg)) {
        await Promise.all(
          cg.map(async coin => {
            const symbol = (coin.symbol + 'usdt').toUpperCase();
            const klines = await fetchKlines(symbol, interval, 50);
            klinesObj[coin.id] = klines;
          })
        );
      }
      setKlinesMap(klinesObj);
      setLoading(false);
    }
    getData();
  }, [interval]);

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Crypto Dashboard (API Test)</h1>
      {loading && <div>Loading...</div>}
      {!loading && (
        <>
          <IntervalDropdown value={interval} onChange={setInterval} />
          <h2>CoinGecko Top 20</h2>
          <MarketTable data={cgData} klinesMap={klinesMap} interval={interval} />
        </>
      )}
    </div>
  );
}
