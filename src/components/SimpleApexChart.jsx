import React from 'react';
import PropTypes from 'prop-types';
import Chart from 'react-apexcharts';

// Helper to format timestamp as HH:mm:ss (24h)
// Commented out to fix ESLint warning as it's not currently used
// function formatSignalTime(triggeredAt) {
//   if (!triggeredAt) return '';
//   const d = new Date(triggeredAt);
//   return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
// }

export default function SimpleApexChart({ klines, signals }) {
  if (!Array.isArray(klines) || klines.length === 0) {
    return <div style={{ padding: 16, color: '#eee' }}>No chart data</div>;
  }

  // Format data for candlestick chart
  const candlestickData = klines.map(k => ({
    x: new Date(Number(k[0])),
    y: [
      parseFloat(k[1]), // open
      parseFloat(k[2]), // high
      parseFloat(k[3]), // low
      parseFloat(k[4])  // close
    ]
  }));

  // Create arrays for buy and sell signals
  const buySignalSeries = [];
  const sellSignalSeries = [];

  // Process signals
  if (signals) {
    // For each signal type (wavetrend, rsi, ema, etc.)
    for (const key in signals) {
      if (key === 'activeSignals') continue; // Skip the activeSignals array
      
      const signal = signals[key];
      if (!signal || !signal.signal || !signal.triggeredAt) continue;
      
      // Convert triggeredAt to Date if it's not already
      const triggeredTime = signal.triggeredAt instanceof Date 
        ? signal.triggeredAt 
        : new Date(signal.triggeredAt);
      
      // Find the corresponding kline
      const idx = klines.findIndex(k => {
        const klineTime = new Date(Number(k[0]));
        return Math.abs(klineTime - triggeredTime) < 60 * 1000;
      });
      
      if (idx >= 0) {
        const price = parseFloat(klines[idx][4]); // close price
        const dataPoint = {
          x: new Date(Number(klines[idx][0])),
          y: price
        };
        
        if (signal.signal === 'Buy') {
          buySignalSeries.push(dataPoint);
        } else if (signal.signal === 'Sell') {
          sellSignalSeries.push(dataPoint);
        }
      }
    }
  }

  // Chart options
  const options = {
    chart: {
      type: 'candlestick',
      height: 350,
      background: '#181a20',
      foreColor: '#eee',
      toolbar: {
        show: true,
        tools: {
          download: false,
          selection: true,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true
        }
      },
      animations: {
        enabled: false
      }
    },
    grid: {
      borderColor: '#23263a',
      strokeDashArray: 0,
      position: 'back'
    },
    plotOptions: {
      candlestick: {
        colors: {
          upward: '#00e1b4',
          downward: '#ff3860'
        },
        wick: {
          useFillColor: true
        }
      }
    },
    xaxis: {
      type: 'datetime',
      labels: {
        datetimeUTC: false,
        style: {
          colors: '#aaa'
        },
        format: 'HH:mm'
      },
      axisBorder: {
        color: '#23263a'
      },
      axisTicks: {
        color: '#23263a'
      }
    },
    yaxis: {
      tooltip: {
        enabled: true
      },
      labels: {
        style: {
          colors: '#aaa'
        },
        formatter: (value) => value.toFixed(2)
      },
      forceNiceScale: true,
      floating: false,
      decimalsInFloat: 2
    },
    tooltip: {
      enabled: true,
      theme: 'dark',
      x: {
        format: 'HH:mm:ss'
      },
      y: {
        formatter: (value) => {
          if (Array.isArray(value)) {
            return `Open: $${value[0].toFixed(2)} · High: $${value[1].toFixed(2)} · Low: $${value[2].toFixed(2)} · Close: $${value[3].toFixed(2)}`;
          }
          return `$${value.toFixed(2)}`;
        }
      }
    },
    theme: {
      mode: 'dark',
      palette: 'palette1'
    },
    stroke: {
      width: [1, 3, 3]
    }
  };

  // Series data
  const series = [
    {
      name: 'Price',
      type: 'candlestick',
      data: candlestickData
    },
    {
      name: 'Buy Signals',
      type: 'scatter',
      data: buySignalSeries,
      marker: {
        size: 10,
        shape: 'triangle',
        fillColors: ['#00e1b4'],
        strokeColors: ['#fff'],
        strokeWidth: 2
      }
    },
    {
      name: 'Sell Signals',
      type: 'scatter',
      data: sellSignalSeries,
      marker: {
        size: 10,
        shape: 'triangle-down',
        fillColors: ['#ff3860'],
        strokeColors: ['#fff'],
        strokeWidth: 2
      }
    }
  ];

  return (
    <div style={{ background: '#181a20', borderRadius: 12, margin: 8, boxShadow: '0 2px 24px #000b', padding: '12px 0' }}>
      <Chart
        options={options}
        series={series}
        type="candlestick"
        height={350}
      />
    </div>
  );
}

SimpleApexChart.propTypes = {
  klines: PropTypes.array,
  signals: PropTypes.object
};
