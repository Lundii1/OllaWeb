"use client";

import { useRef, useEffect } from 'react';
import type { ChartDataPoint, ChartPeriod } from '../../lib/types';

interface StockChartProps {
  data: ChartDataPoint[];
  period: ChartPeriod;
}

export function StockChart({ data, period }: StockChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    let cancelled = false;

    (async () => {
      // Dynamic import to avoid SSR issues
      const lc = await import('lightweight-charts');
      if (cancelled || !containerRef.current) return;

      // Remove previous chart
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }

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
          timeVisible: period === '1d' || period === '5d',
        },
        rightPriceScale: {
          borderColor: '#3a3a5c',
        },
      });

      const isIntraday = period === '1d' || period === '5d';

      if (isIntraday) {
        const series = chart.addSeries(lc.LineSeries, {
          color: '#39ff14',
          lineWidth: 2,
        });
        series.setData(
          data.map((d) => ({ time: d.time as any, value: d.close }))
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
          data.map((d) => ({
            time: d.time as any,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
          }))
        );
      }

      chart.timeScale().fitContent();
      chartRef.current = chart;

      // Resize observer
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
  }, [data, period]);

  return <div ref={containerRef} className="w-full h-full" />;
}
