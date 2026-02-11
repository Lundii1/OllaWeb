"use client";

import { useRef, useEffect } from 'react';
import type { ChartDataPoint, ChartPeriod, IndicatorConfig, ComparisonTicker } from '../../lib/types';
import { computeSMA, computeEMA, computeRSI, computeMACD, computeBollingerBands } from '../../lib/technical-indicators';

interface StockChartProps {
  data: ChartDataPoint[];
  period: ChartPeriod;
  indicators?: IndicatorConfig;
  comparisonData?: ComparisonTicker[];
}

export function StockChart({ data, period, indicators, comparisonData }: StockChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    let cancelled = false;

    (async () => {
      const lc = await import('lightweight-charts');
      if (cancelled || !containerRef.current) return;

      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }

      const isComparison = comparisonData && comparisonData.length > 0;
      const isIntraday = period === '1d' || period === '5d';

      const chart = lc.createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
        layout: {
          background: { color: '#1a1a2e' } as any,
          textColor: '#c0c0c0',
          fontFamily: "'VT323', 'Courier New', monospace",
        },
        grid: {
          vertLines: { color: '#2a2a4e' },
          horzLines: { color: '#2a2a4e' },
        },
        crosshair: {
          vertLine: { color: '#00d4ff', labelBackgroundColor: '#0f3460' },
          horzLine: { color: '#00d4ff', labelBackgroundColor: '#0f3460' },
        },
        timeScale: {
          borderColor: '#3a3a5c',
          timeVisible: isIntraday,
        },
        rightPriceScale: {
          borderColor: '#3a3a5c',
        },
      });

      const closes = data.map(d => d.close);
      const times = data.map(d => d.time);

      if (isComparison) {
        // Comparison mode: normalize to % change
        const basePrice = data[0].close;
        const mainSeries = chart.addSeries(lc.LineSeries, {
          color: '#39ff14',
          lineWidth: 2,
          priceFormat: { type: 'custom', formatter: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` },
        });
        mainSeries.setData(
          data.map(d => ({
            time: d.time as any,
            value: ((d.close - basePrice) / basePrice) * 100,
          }))
        );

        for (const comp of comparisonData!) {
          if (comp.data.length === 0) continue;
          const compBase = comp.data[0].close;
          const compSeries = chart.addSeries(lc.LineSeries, {
            color: comp.color,
            lineWidth: 2,
            priceFormat: { type: 'custom', formatter: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` },
          });
          compSeries.setData(
            comp.data.map(d => ({
              time: d.time as any,
              value: ((d.close - compBase) / compBase) * 100,
            }))
          );
        }
      } else {
        // Standard chart
        if (isIntraday) {
          const series = chart.addSeries(lc.LineSeries, {
            color: '#39ff14',
            lineWidth: 2,
          });
          series.setData(
            data.map(d => ({ time: d.time as any, value: d.close }))
          );
        } else {
          const series = chart.addSeries(lc.CandlestickSeries, {
            upColor: '#39ff14',
            downColor: '#ff3333',
            borderUpColor: '#39ff14',
            borderDownColor: '#ff3333',
            wickUpColor: '#39ff14',
            wickDownColor: '#ff3333',
          });
          series.setData(
            data.map(d => ({
              time: d.time as any,
              open: d.open,
              high: d.high,
              low: d.low,
              close: d.close,
            }))
          );
        }

        // Technical indicators (non-comparison only)
        if (indicators) {
          if (indicators.sma) {
            const smaValues = computeSMA(closes, 20);
            const smaSeries = chart.addSeries(lc.LineSeries, {
              color: '#00d4ff',
              lineWidth: 1,
              lastValueVisible: false,
              priceLineVisible: false,
            });
            smaSeries.setData(
              smaValues
                .map((v, i) => v != null ? { time: times[i] as any, value: v } : null)
                .filter((d): d is { time: any; value: number } => d != null)
            );
          }

          if (indicators.ema) {
            const emaValues = computeEMA(closes, 12);
            const emaSeries = chart.addSeries(lc.LineSeries, {
              color: '#ffb000',
              lineWidth: 1,
              lastValueVisible: false,
              priceLineVisible: false,
            });
            emaSeries.setData(
              emaValues
                .map((v, i) => v != null ? { time: times[i] as any, value: v } : null)
                .filter((d): d is { time: any; value: number } => d != null)
            );
          }

          if (indicators.bollinger) {
            const bb = computeBollingerBands(closes, 20, 2);
            const upperSeries = chart.addSeries(lc.LineSeries, {
              color: '#4488ff', lineWidth: 1, lineStyle: 2,
              lastValueVisible: false, priceLineVisible: false,
            });
            upperSeries.setData(
              bb.upper.map((v, i) => v != null ? { time: times[i] as any, value: v } : null)
                .filter((d): d is { time: any; value: number } => d != null)
            );
            const middleSeries = chart.addSeries(lc.LineSeries, {
              color: '#4488ff', lineWidth: 1,
              lastValueVisible: false, priceLineVisible: false,
            });
            middleSeries.setData(
              bb.middle.map((v, i) => v != null ? { time: times[i] as any, value: v } : null)
                .filter((d): d is { time: any; value: number } => d != null)
            );
            const lowerSeries = chart.addSeries(lc.LineSeries, {
              color: '#4488ff', lineWidth: 1, lineStyle: 2,
              lastValueVisible: false, priceLineVisible: false,
            });
            lowerSeries.setData(
              bb.lower.map((v, i) => v != null ? { time: times[i] as any, value: v } : null)
                .filter((d): d is { time: any; value: number } => d != null)
            );
          }

          if (indicators.rsi) {
            const rsiValues = computeRSI(closes, 14);
            const rsiSeries = chart.addSeries(lc.LineSeries, {
              color: '#a855f7', lineWidth: 1,
              lastValueVisible: true, priceLineVisible: false,
              pane: 1,
              priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(1) },
            } as any);
            rsiSeries.setData(
              rsiValues.map((v, i) => v != null ? { time: times[i] as any, value: v } : null)
                .filter((d): d is { time: any; value: number } => d != null)
            );
            const rsiTimestamps = rsiValues
              .map((v, i) => v != null ? times[i] : null)
              .filter((t): t is number => t != null);
            const ob70 = chart.addSeries(lc.LineSeries, {
              color: '#ff333366', lineWidth: 1, lineStyle: 2,
              lastValueVisible: false, priceLineVisible: false, pane: 1,
            } as any);
            ob70.setData(rsiTimestamps.map(t => ({ time: t as any, value: 70 })));
            const os30 = chart.addSeries(lc.LineSeries, {
              color: '#39ff1466', lineWidth: 1, lineStyle: 2,
              lastValueVisible: false, priceLineVisible: false, pane: 1,
            } as any);
            os30.setData(rsiTimestamps.map(t => ({ time: t as any, value: 30 })));
          }

          if (indicators.macd) {
            const macdData = computeMACD(closes, 12, 26, 9);
            const paneIdx = indicators.rsi ? 2 : 1;
            const macdSeries = chart.addSeries(lc.LineSeries, {
              color: '#00d4ff', lineWidth: 1,
              lastValueVisible: false, priceLineVisible: false, pane: paneIdx,
            } as any);
            macdSeries.setData(
              macdData.macd.map((v, i) => v != null ? { time: times[i] as any, value: v } : null)
                .filter((d): d is { time: any; value: number } => d != null)
            );
            const signalSeries = chart.addSeries(lc.LineSeries, {
              color: '#ffb000', lineWidth: 1,
              lastValueVisible: false, priceLineVisible: false, pane: paneIdx,
            } as any);
            signalSeries.setData(
              macdData.signal.map((v, i) => v != null ? { time: times[i] as any, value: v } : null)
                .filter((d): d is { time: any; value: number } => d != null)
            );
            const histSeries = chart.addSeries(lc.HistogramSeries, {
              lastValueVisible: false, priceLineVisible: false, pane: paneIdx,
            } as any);
            histSeries.setData(
              macdData.histogram.map((v, i) => v != null ? {
                time: times[i] as any, value: v,
                color: v >= 0 ? '#39ff1488' : '#ff333388',
              } : null)
                .filter((d): d is { time: any; value: number; color: string } => d != null)
            );
          }
        }
      }

      chart.timeScale().fitContent();
      chartRef.current = chart;

      const observer = new ResizeObserver(() => {
        if (containerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
          });
        }
      });
      observer.observe(containerRef.current);
    })();

    return () => {
      cancelled = true;
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [data, period, indicators, comparisonData]);

  return <div ref={containerRef} className="w-full h-full" />;
}
