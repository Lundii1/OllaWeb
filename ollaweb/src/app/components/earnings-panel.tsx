"use client";

import { useState, useEffect } from 'react';
import type { EarningsData } from '../../lib/types';

interface EarningsPanelProps {
  ticker: string;
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function EarningsPanel({ ticker }: EarningsPanelProps) {
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    setError(null);
    fetch(`/api/finance/earnings?ticker=${encodeURIComponent(ticker)}`)
      .then(async res => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch');
        setData(json);
      })
      .catch(err => {
        setError(err.message);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [ticker]);

  if (!ticker) {
    return (
      <div className="px-3 py-4 text-center text-retro-border-light text-xs">
        Load a ticker to view earnings
      </div>
    );
  }

  if (loading) {
    return (
      <div className="px-3 py-4 text-center">
        <span className="text-retro-cyan retro-blink text-xs">Loading earnings...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-4 text-center text-retro-red text-xs">[ERROR] {error}</div>
    );
  }

  if (!data) return null;

  return (
    <div className="overflow-y-auto text-xs">
      {/* Next Earnings */}
      {data.nextEarningsDate && (
        <div className="px-3 py-2 border-b border-retro-border-light">
          <div className="text-retro-amber mb-1">Next Earnings</div>
          <div className="flex justify-between items-center">
            <span className="text-retro-text-bright">{data.nextEarningsDate}</span>
            <span className="text-retro-cyan">
              {daysUntil(data.nextEarningsDate) > 0
                ? `in ${daysUntil(data.nextEarningsDate)}d`
                : 'Today'}
            </span>
          </div>
        </div>
      )}

      {/* EPS History */}
      {data.history.length > 0 && (
        <div className="px-3 py-2 border-b border-retro-border-light">
          <div className="text-retro-amber mb-1.5">EPS History</div>
          <div className="space-y-1">
            <div className="flex text-retro-border-light">
              <span className="w-16">Period</span>
              <span className="w-14 text-right">Est</span>
              <span className="w-14 text-right">Act</span>
              <span className="flex-1 text-right">Surprise</span>
            </div>
            {data.history.map((h, i) => (
              <div key={i} className="flex items-center">
                <span className="w-16 text-retro-text">{h.date || h.quarter}</span>
                <span className="w-14 text-right text-retro-text-bright font-mono">
                  {h.epsEstimate != null ? h.epsEstimate.toFixed(2) : '—'}
                </span>
                <span className="w-14 text-right text-retro-text-bright font-mono">
                  {h.epsActual != null ? h.epsActual.toFixed(2) : '—'}
                </span>
                <span className={`flex-1 text-right font-mono ${
                  h.surprisePercent != null
                    ? h.surprisePercent >= 0 ? 'text-retro-green' : 'text-retro-red'
                    : 'text-retro-border-light'
                }`}>
                  {h.surprisePercent != null
                    ? `${h.surprisePercent >= 0 ? '+' : ''}${h.surprisePercent.toFixed(1)}%`
                    : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Forward Estimates */}
      {data.trend.length > 0 && (
        <div className="px-3 py-2 border-b border-retro-border-light">
          <div className="text-retro-amber mb-1.5">Forward Estimates</div>
          <div className="space-y-1">
            <div className="flex text-retro-border-light">
              <span className="w-16">Period</span>
              <span className="w-14 text-right">EPS</span>
              <span className="flex-1 text-right">Growth</span>
            </div>
            {data.trend.map((t, i) => (
              <div key={i} className="flex items-center">
                <span className="w-16 text-retro-text">{t.period}</span>
                <span className="w-14 text-right text-retro-text-bright font-mono">
                  {t.epsEstimate != null ? t.epsEstimate.toFixed(2) : '—'}
                </span>
                <span className={`flex-1 text-right font-mono ${
                  t.growth != null
                    ? t.growth >= 0 ? 'text-retro-green' : 'text-retro-red'
                    : 'text-retro-border-light'
                }`}>
                  {t.growth != null ? `${t.growth >= 0 ? '+' : ''}${t.growth.toFixed(1)}%` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EPS Revisions */}
      {data.epsRevisions.length > 0 && (
        <div className="px-3 py-2">
          <div className="text-retro-amber mb-1.5">EPS Revisions (30d)</div>
          <div className="space-y-1">
            <div className="flex text-retro-border-light">
              <span className="w-16">Period</span>
              <span className="w-10 text-right">Up</span>
              <span className="w-10 text-right">Down</span>
            </div>
            {data.epsRevisions.map((r, i) => (
              <div key={i} className="flex items-center">
                <span className="w-16 text-retro-text">{r.period}</span>
                <span className="w-10 text-right text-retro-green font-mono">
                  {r.upLast30 ?? '—'}
                </span>
                <span className="w-10 text-right text-retro-red font-mono">
                  {r.downLast30 ?? '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
