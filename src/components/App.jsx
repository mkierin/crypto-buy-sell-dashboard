import React, { useEffect, useState } from 'react';
import { fetchMarketData } from '../api/coingecko';
import { fetchKlines, fetchFunding, fetchOpenInterest } from '../api/binance';
import MarketTable from './MarketTable.jsx';
import IntervalDropdown from './IntervalDropdown.jsx';
import SignalsDashboard from './SignalsDashboard.jsx';
import '../styles/app.css';

export default function App() {
  const [cgData, setCgData] = useState(null);
  const [klinesMap, setKlinesMap] = useState({}); // { symbol: klines[] }
  const [fundingMap, setFundingMap] = useState({}); // { symbol: funding }
  const [oiMap, setOiMap] = useState({}); // { symbol: openInterest[] }
  const [interval, setInterval] = useState('1h');
  const [loading, setLoading] = useState(true);
  const [timeframeLoading, setTimeframeLoading] = useState(false); // Separate loading state for timeframe changes
  const [activePage, setActivePage] = useState('dashboard'); // 'dashboard' or 'signals'

  // Separate useEffect for initial market data fetch and periodic refresh
  useEffect(() => {
    let timeout;
    let cancelled = false;
    
    async function fetchMarketDataOnly() {
      try {
        console.log('Fetching market data...');
        // Only set loading on initial load, not on refreshes
        if (!cgData) setLoading(true);
        
        // Fetch CoinGecko market data for top 20 coins
        const cg = await fetchMarketData();
        
        if (!cancelled) {
          console.log(`Received market data for ${cg ? cg.length : 0} coins`);
          if (!cg || !Array.isArray(cg) || cg.length === 0) {
            console.error('Market data is empty or invalid:', cg);
          } else {
            // Log the first coin to check structure
            console.log('Sample coin data:', cg[0]);
          }
          
          setCgData(cg);
          
          // Only remove loading state if we already have klines data
          if (Object.keys(klinesMap).length > 0) {
            setLoading(false);
          }
        }
        
        // Schedule next refresh
        if (!cancelled) {
          timeout = setTimeout(fetchMarketDataOnly, 5 * 60 * 1000); // Refresh market data every 5 minutes
        }
      } catch (error) {
        console.error('Error fetching market data:', error);
        if (!cancelled) setLoading(false);
      }
    }
    
    fetchMarketDataOnly();
    
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, []); // Only run on mount
  
  // Separate useEffect for klines, funding, and OI data that depends on interval
  useEffect(() => {
    let timeout;
    let cancelled = false;
    
    async function fetchTimeframeData() {
      // Set timeframeLoading to true when changing timeframes
      setTimeframeLoading(true);
      
      // Only set full loading indicator if we don't have any data yet
      if (Object.keys(klinesMap).length === 0) {
        setLoading(true);
      }
      
      // Fetch klines, funding, and open interest for each coin
      const klinesObj = {};
      const fundingObj = {};
      const oiObj = {};
      
      if (cgData && Array.isArray(cgData)) {
        // Use Promise.all for parallel requests but process in batches to avoid rate limits
        const batchSize = 5;
        const coins = [...cgData];
        
        for (let i = 0; i < coins.length; i += batchSize) {
          const batch = coins.slice(i, i + batchSize);
          await Promise.all(
            batch.map(async coin => {
              const symbol = (coin.symbol + 'usdt').toUpperCase();
              try {
                const klines = await fetchKlines(symbol, interval, 50);
                klinesObj[coin.id] = klines;
                
                const funding = await fetchFunding(symbol);
                fundingObj[coin.id] = funding;
                
                const oi = await fetchOpenInterest(symbol);
                oiObj[coin.id] = oi;
              } catch (error) {
                console.error(`Error fetching data for ${symbol}:`, error);
              }
            })
          );
          
          // Small delay between batches to avoid rate limits
          if (i + batchSize < coins.length && !cancelled) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
      }
      
      if (!cancelled) {
        setKlinesMap(klinesObj);
        setFundingMap(fundingObj);
        setOiMap(oiObj);
        setLoading(false);
        setTimeframeLoading(false); // Reset timeframe loading state
      }
      
      // Schedule next refresh based on interval
      if (!cancelled) {
        let refreshInterval;
        if (interval === '3m') refreshInterval = 3 * 60 * 1000;
        else if (interval === '5m') refreshInterval = 5 * 60 * 1000;
        else if (interval === '15m') refreshInterval = 15 * 60 * 1000;
        else if (interval === '30m') refreshInterval = 30 * 60 * 1000;
        else refreshInterval = 60 * 60 * 1000; // Default to 1 hour
        
        timeout = setTimeout(fetchTimeframeData, refreshInterval);
      }
    }
    
    fetchTimeframeData();
    
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [cgData, interval]); // Depend on both cgData and interval

  // Function to handle timeframe change
  const handleIntervalChange = (newInterval) => {
    // Set the new interval and indicate loading state
    setTimeframeLoading(true);
    setInterval(newInterval); // Update interval immediately to reflect in UI
    
    // Fetch only the timeframe-specific data in the background
    const fetchNewTimeframeData = async () => {
      try {
        console.log(`Fetching data for new timeframe: ${newInterval}`);
        // Create new objects to store updated data
        const newKlinesMap = {};
        const newFundingMap = {};
        const newOiMap = {};
        
        if (cgData && Array.isArray(cgData)) {
          // Process in batches to avoid rate limits
          const batchSize = 5;
          const coins = [...cgData];
          
          for (let i = 0; i < coins.length; i += batchSize) {
            const batch = coins.slice(i, i + batchSize);
            await Promise.all(
              batch.map(async coin => {
                const symbol = (coin.symbol + 'usdt').toUpperCase();
                try {
                  // Fetch klines data for the new interval
                  const klines = await fetchKlines(symbol, newInterval, 50);
                  if (klines) {
                    newKlinesMap[coin.id] = klines;
                  }
                  
                  // Also update funding and OI data
                  const funding = await fetchFunding(symbol);
                  if (funding) {
                    newFundingMap[coin.id] = funding;
                  }
                  
                  const oi = await fetchOpenInterest(symbol);
                  if (oi) {
                    newOiMap[coin.id] = oi;
                  }
                } catch (error) {
                  console.error(`Error fetching data for ${symbol}:`, error);
                }
              })
            );
            
            // Small delay between batches
            if (i + batchSize < coins.length) {
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          }
        }
        
        // Update the state with new data
        console.log(`Received klines data for ${Object.keys(newKlinesMap).length} coins`);
        setKlinesMap(newKlinesMap);
        setFundingMap(newFundingMap);
        setOiMap(newOiMap);
        setTimeframeLoading(false);
      } catch (error) {
        console.error('Error updating timeframe data:', error);
        setTimeframeLoading(false);
      }
    };
    
    fetchNewTimeframeData();
  };
  
  // Function to handle page navigation
  const handlePageChange = (page) => {
    setActivePage(page);
  };

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <header className="app-header">
        <h1>Crypto Dashboard</h1>
        <nav className="main-nav">
          <ul>
            <li>
              <button 
                className={activePage === 'dashboard' ? 'active' : ''} 
                onClick={() => handlePageChange('dashboard')}
              >
                Market Dashboard
              </button>
            </li>
            <li>
              <button 
                className={activePage === 'signals' ? 'active' : ''} 
                onClick={() => handlePageChange('signals')}
              >
                Signals Dashboard
              </button>
            </li>
          </ul>
        </nav>
      </header>

      {activePage === 'dashboard' && (
        <div className="dashboard-page">
          {loading && <div className="loading-indicator">Loading...</div>}
          {!loading && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <IntervalDropdown value={interval} onChange={handleIntervalChange} />
                {timeframeLoading && (
                  <div style={{ color: '#4287f5', fontSize: '14px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: '8px' }}>Updating data</span>
                    <div style={{ width: '16px', height: '16px', border: '2px solid #4287f5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    <style>{`
                      @keyframes spin {
                        to { transform: rotate(360deg); }
                      }
                    `}</style>
                  </div>
                )}
              </div>
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
      )}

      {activePage === 'signals' && (
        <SignalsDashboard />
      )}
    </div>
  );
}
