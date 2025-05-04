import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import Chart from 'react-apexcharts';

// Helper to format timestamp as HH:mm:ss (24h)
function formatSignalTime(triggeredAt) {
  if (!triggeredAt) return '';
  const d = new Date(triggeredAt);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export default function ApexMiniChart({ klines, signals }) {
  // Add console logs to debug signals
  console.log('ApexMiniChart signals:', signals);
  console.log('ApexMiniChart klines length:', klines?.length);
  
  // Process data for ApexCharts
  const chartData = useMemo(() => {
    if (!Array.isArray(klines) || klines.length === 0) return null;
    
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
    
    // Format volume data
    const volumeData = klines.map(k => ({
      x: new Date(Number(k[0])),
      y: parseFloat(k[5])
    }));
    
    // Find signal indices for each type
    const signalPoints = {};
    if (signals && typeof signals === 'object') {
      for (const key of ['wavetrend', 'rsi', 'ema', 'wt_ema', 'rsi_ema', 'wt_rsi', 'cluster', 'confluence']) {
        const s = signals[key];
        if (s && s.signal && s.triggeredAt) {
          // Handle both Date objects and timestamps
          const triggeredTime = s.triggeredAt instanceof Date ? s.triggeredAt : new Date(s.triggeredAt);
          
          // Find the closest kline to the signal time
          const idx = klines.findIndex(k => {
            const klineTime = new Date(Number(k[0]));
            return Math.abs(klineTime - triggeredTime) < 60 * 1000;
          });
          
          if (idx >= 0) {
            signalPoints[key] = {
              index: idx,
              signal: s.signal,
              timestamp: triggeredTime,
              price: parseFloat(klines[idx][4]),
              formattedTime: formatSignalTime(triggeredTime)
            };
          }
        }
      }
    }
    
    // Volume spike detection: volume > 2x avg of previous 20
    const volumeSpikes = [];
    for (let i = 20; i < klines.length; ++i) {
      const prev = klines.slice(i - 20, i);
      const avgVol = prev.reduce((a, k) => a + Number(k[5]), 0) / 20;
      const vol = Number(klines[i][5]);
      if (avgVol > 0 && vol > 2 * avgVol) {
        volumeSpikes.push({
          index: i,
          timestamp: Number(klines[i][0]),
          volume: vol,
          formattedTime: formatSignalTime(Number(klines[i][0])),
          x: new Date(Number(klines[i][0])),
          y: parseFloat(klines[i][3]) // Position marker at the low price
        });
      }
    }
    
    return { candlestickData, volumeData, signalPoints, volumeSpikes };
  }, [klines, signals]);
  
  if (!chartData) return <div style={{ padding: 16, color: '#eee' }}>No chart data</div>;
  
  // Create buy and sell markers for active signals
  const buyMarkers = [];
  const sellMarkers = [];
  
  // Debug active signals
  console.log('Active signals:', signals?.activeSignals);
  console.log('Signal points:', chartData.signalPoints);
  
  // Process all signal points if no active signals are specified
  const keysToProcess = signals && Array.isArray(signals.activeSignals) && signals.activeSignals.length > 0 
    ? signals.activeSignals 
    : Object.keys(chartData.signalPoints);
  
  keysToProcess.forEach(sigKey => {
    console.log(`Processing signal: ${sigKey}`);
    const signalPoint = chartData.signalPoints[sigKey];
    console.log(`Signal point for ${sigKey}:`, signalPoint);
    if (signalPoint) {
        // Create a marker with arrow and info box
        const marker = {
          x: chartData.candlestickData[signalPoint.index].x,
          y: signalPoint.price,
          marker: {
            size: signalPoint.signal === 'Buy' ? 10 : 10,
            fillColor: signalPoint.signal === 'Buy' ? '#00e1b4' : '#ff3860',
            strokeColor: '#fff',
            strokeWidth: 2,
            radius: 2,
            shape: signalPoint.signal === 'Buy' ? 'triangle' : 'triangle-down',
          },
          label: {
            borderColor: signalPoint.signal === 'Buy' ? '#00e1b4' : '#ff3860',
            borderWidth: 2,
            borderRadius: 5,
            textAnchor: 'middle',
            position: signalPoint.signal === 'Buy' ? 'bottom' : 'top',
            offsetY: signalPoint.signal === 'Buy' ? 15 : -15,
            style: {
              background: '#181a20',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cssClass: 'apexcharts-signal-label',
              padding: {
                left: 10,
                right: 10,
                top: 5,
                bottom: 5
              }
            },
            text: `$${signalPoint.price.toFixed(2)} at ${signalPoint.formattedTime}`
          }
        };
        
        if (signalPoint.signal === 'Buy') {
          buyMarkers.push(marker);
        } else {
          sellMarkers.push(marker);
        }
      }
    });
  
  // Create volume spike markers
  const volumeSpikeMarkers = chartData.volumeSpikes.map(spike => ({
    x: spike.x,
    y: spike.y,
    marker: {
      size: 8,
      fillColor: '#b266ff',
      strokeColor: '#fff',
      strokeWidth: 2,
      shape: 'diamond',
      radius: 2
    },
    label: {
      borderColor: '#b266ff',
      borderWidth: 2,
      borderRadius: 5,
      textAnchor: 'middle',
      position: 'bottom',
      offsetY: 15,
      style: {
        background: '#181a20',
        color: '#fff',
        fontSize: '13px',
        fontWeight: 600,
        cssClass: 'apexcharts-volume-label',
        padding: {
          left: 10,
          right: 10,
          top: 5,
          bottom: 5
        }
      },
      text: `Vol: ${spike.volume.toLocaleString()} at ${spike.formattedTime}`
    }
  }));
  
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
      },
      events: {
        markerClick: function(event, chartContext, { seriesIndex, dataPointIndex, config }) {
          // Optional: Add custom behavior when markers are clicked
        }
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
    annotations: {
      points: [
        ...buyMarkers,
        ...sellMarkers,
        ...volumeSpikeMarkers
      ],
      position: 'front'
    },
    theme: {
      mode: 'dark',
      palette: 'palette1'
    },
    stroke: {
      width: 1
    }
  };
  
  const series = [{
    name: 'Price',
    data: chartData.candlestickData
  }];
  
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

ApexMiniChart.propTypes = {
  klines: PropTypes.array,
  signals: PropTypes.object
};
