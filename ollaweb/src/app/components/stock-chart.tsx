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
    let chartInstance: any = null;
    let resizeObserver: ResizeObserver | null = null;

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
          background: { color: 'transparent' } as any,
          textColor: '#b4b4b4',
          fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.05)' },
          horzLines: { color: 'rgba(255,255,255,0.05)' },
        },
        crosshair: {
          vertLine: { 
            color: 'rgba(255,255,255,0.35)',
            labelBackgroundColor: '#2f2f2f',
            width: 1,
            style: lc.LineStyle.SparseDotted,
          },
          horzLine: { 
            color: 'rgba(255,255,255,0.35)',
            labelBackgroundColor: '#2f2f2f',
            width: 1,
            style: lc.LineStyle.SparseDotted,
          },
        },
        timeScale: {
          borderColor: 'rgba(255,255,255,0.1)',
          timeVisible: isIntraday,
        },
        rightPriceScale: {
          borderColor: 'rgba(255,255,255,0.1)',
        },
      });

      const closes = data.map(d => d.close);
      const times = data.map(d => d.time);

      if (isComparison) {
        // Comparison mode: normalize to % change
        const basePrice = data[0].close;
        const mainSeries = chart.addSeries(lc.LineSeries, {
          color: '#67e8f9',
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
            color: '#67e8f9',
            lineWidth: 2,
          });
          series.setData(
            data.map(d => ({ time: d.time as any, value: d.close }))
          );
        } else {
          const series = chart.addSeries(lc.CandlestickSeries, {
            upColor: '#34d399',
            downColor: '#f87171',
            borderUpColor: '#34d399',
            borderDownColor: '#f87171',
            wickUpColor: '#34d399',
            wickDownColor: '#f87171',
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
              priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(1) },
            } as any, 1);
            rsiSeries.setData(
              rsiValues.map((v, i) => v != null ? { time: times[i] as any, value: v } : null)
                .filter((d): d is { time: any; value: number } => d != null)
            );
            const rsiTimestamps = rsiValues
              .map((v, i) => v != null ? times[i] : null)
              .filter((t): t is number => t != null);
            const ob70 = chart.addSeries(lc.LineSeries, {
              color: '#f8717166', lineWidth: 1, lineStyle: 2,
              lastValueVisible: false, priceLineVisible: false,
            } as any, 1);
            ob70.setData(rsiTimestamps.map(t => ({ time: t as any, value: 70 })));
            const os30 = chart.addSeries(lc.LineSeries, {
              color: '#34d39966', lineWidth: 1, lineStyle: 2,
              lastValueVisible: false, priceLineVisible: false,
            } as any, 1);
            os30.setData(rsiTimestamps.map(t => ({ time: t as any, value: 30 })));
          }

          if (indicators.macd) {
            const macdData = computeMACD(closes, 12, 26, 9);
            const paneIdx = indicators.rsi ? 2 : 1;
            const macdSeries = chart.addSeries(lc.LineSeries, {
              color: '#00d4ff', lineWidth: 1,
              lastValueVisible: false, priceLineVisible: false,
            } as any, paneIdx);
            macdSeries.setData(
              macdData.macd.map((v, i) => v != null ? { time: times[i] as any, value: v } : null)
                .filter((d): d is { time: any; value: number } => d != null)
            );
            const signalSeries = chart.addSeries(lc.LineSeries, {
              color: '#ffb000', lineWidth: 1,
              lastValueVisible: false, priceLineVisible: false,
            } as any, paneIdx);
            signalSeries.setData(
              macdData.signal.map((v, i) => v != null ? { time: times[i] as any, value: v } : null)
                .filter((d): d is { time: any; value: number } => d != null)
            );
            const histSeries = chart.addSeries(lc.HistogramSeries, {
              lastValueVisible: false, priceLineVisible: false,
            } as any, paneIdx);
            histSeries.setData(
              macdData.histogram.map((v, i) => v != null ? {
                time: times[i] as any, value: v,
                color: v >= 0 ? '#34d39988' : '#f8717188',
              } : null)
                .filter((d): d is { time: any; value: number; color: string } => d != null)
            );
          }
        }
      }

      chart.timeScale().fitContent();
      chartInstance = chart;
      chartRef.current = chart;

      resizeObserver = new ResizeObserver(() => {
        if (containerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
          });
        }
      });
      resizeObserver.observe(containerRef.current);
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      if (chartInstance) {
        chartInstance.remove();
      }
      if (chartRef.current === chartInstance) {
        chartRef.current = null;
      }
    };
  }, [data, period, indicators, comparisonData]);

  return <div ref={containerRef} className="w-full h-full" />;
}
