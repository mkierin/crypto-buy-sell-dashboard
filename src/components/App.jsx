import React, { useEffect, useState } from 'react';
import { fetchMarketData } from '../api/coingecko';
import { fetchTicker } from '../api/binance';
import '../styles/app.css';

export default function App() {
  const [cgData, setCgData] = useState(null);
  const [ticker, setTicker] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getData() {
      setLoading(true);
      // Fetch CoinGecko market data for top 20 coins
      const cg = await fetchMarketData();
      setCgData(cg);
      // Example: Fetch Binance ticker for BTCUSDT
      const binanceTicker = await fetchTicker('BTCUSDT');
      setTicker(binanceTicker);
      setLoading(false);
    }
    getData();
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Crypto Dashboard (API Test)</h1>
      {loading && <div>Loading...</div>}
      {!loading && (
        <>
          <h2>CoinGecko Top 20</h2>
          <pre style={{ maxHeight: 200, overflow: 'auto', background: '#222', color: '#fff', padding: 8 }}>
            {JSON.stringify(cgData, null, 2)}
          </pre>
          <h2>Binance BTCUSDT Ticker</h2>
          <pre style={{ background: '#222', color: '#fff', padding: 8 }}>
            {JSON.stringify(ticker, null, 2)}
          </pre>
        </>
      )}
    </div>
  );
}
