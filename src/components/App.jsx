import React, { useEffect, useState } from 'react';
import { fetchMarketData } from '../api/coingecko';
import { fetchKlines, fetchFunding, fetchOpenInterest } from '../api/binance';
import MarketTable from './MarketTable.jsx';
import IntervalDropdown from './IntervalDropdown.jsx';
import '../styles/app.css';

export default function App() {
  const [cgData, setCgData] = useState(null);
  const [klinesMap, setKlinesMap] = useState({}); // { symbol: klines[] }
  const [fundingMap, setFundingMap] = useState({}); // { symbol: funding }
  const [oiMap, setOiMap] = useState({}); // { symbol: openInterest[] }
  const [interval, setInterval] = useState('1h');
  const [loading, setLoading] = useState(true);

  // --- Data polling ---
  useEffect(() => {
    let timeout;
    let cancelled = false;
    async function getData() {
      setLoading(true);
      // Fetch CoinGecko market data for top 20 coins
      const cg = await fetchMarketData();
      setCgData(cg);
      // Fetch klines, funding, and open interest for each coin (Binance symbol = UPPERCASE+USDT)
      const klinesObj = {};
      const fundingObj = {};
      const oiObj = {};
      if (cg && Array.isArray(cg)) {
        await Promise.all(
          cg.map(async coin => {
            const symbol = (coin.symbol + 'usdt').toUpperCase();
            const klines = await fetchKlines(symbol, interval, 50);
            klinesObj[coin.id] = klines;
            const funding = await fetchFunding(symbol);
            fundingObj[coin.id] = funding;
            const oi = await fetchOpenInterest(symbol);
            oiObj[coin.id] = oi;
          })
        );
      }
      setKlinesMap(klinesObj);
      setFundingMap(fundingObj);
      setOiMap(oiObj);
      setLoading(false);
      // --- Schedule next refresh ---
      if (!cancelled) {
        let ms;
        if (interval === '3m') ms = 3 * 60 * 1000;
        else if (interval === '5m') ms = 5 * 60 * 1000;
        else ms = 5 * 60 * 1000;
        timeout = setTimeout(getData, ms);
      }
    }
    getData();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [interval]);

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Crypto Dashboard (API Test)</h1>
      {loading && <div>Loading...</div>}
      {!loading && (
        <>
          <IntervalDropdown value={interval} onChange={setInterval} />
          <h2>CoinGecko Top 20</h2>
          <MarketTable
            data={Array.isArray(cgData)
              ? cgData.filter(coin => {
                  const s = coin.symbol.toLowerCase();
                  const n = coin.name.toLowerCase();
                  return !(
                    s.includes('usdt') || s.includes('usdc') || s.includes('dai') || s.includes('busd') ||
                    s.includes('tusd') || s.includes('usd') || s.includes('weth') ||
                    n.includes('tether') || n.includes('wrapped') || n.includes('staked ether') || n.includes('usd') || n.includes('weth')
                  );
                })
              : cgData}
            klinesMap={klinesMap}
            interval={interval}
            fundingMap={fundingMap}
            oiMap={oiMap}
          />
        </>
      )}
    </div>
  );
}
