"use client";

import { useState, useEffect } from 'react';
import type { AnalystData } from '../../lib/types';

interface AnalystPanelProps {
  ticker: string;
}

export function AnalystPanel({ ticker }: AnalystPanelProps) {
  const [data, setData] = useState<AnalystData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    setError(null);
    fetch(`/api/finance/analysis?ticker=${encodeURIComponent(ticker)}`)
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
        Load a ticker to view analyst data
      </div>
    );
  }

  if (loading) {
    return (
      <div className="px-3 py-4 text-center">
        <span className="text-retro-cyan retro-blink text-xs">Loading analyst data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-4 text-center text-retro-red text-xs">[ERROR] {error}</div>
    );
  }

  if (!data) return null;

  // Current month recommendation
  const currentRec = data.recommendations?.[0];
  const total = currentRec
    ? currentRec.strongBuy + currentRec.buy + currentRec.hold + currentRec.sell + currentRec.strongSell
    : 0;

  return (
    <div className="overflow-y-auto text-xs">
      {/* Consensus Rating Bar */}
      {currentRec && total > 0 && (
        <div className="px-3 py-2 border-b border-retro-border-light">
          <div className="text-retro-amber mb-1.5">Analyst Consensus</div>
          {/* Stacked bar */}
          <div className="flex h-4 retro-sunken overflow-hidden mb-1.5">
            {currentRec.strongBuy > 0 && (
              <div
                className="bg-green-500 flex items-center justify-center text-[9px] text-black font-bold"
                style={{ width: `${(currentRec.strongBuy / total) * 100}%` }}
              >
                {currentRec.strongBuy}
              </div>
            )}
            {currentRec.buy > 0 && (
              <div
                className="bg-green-400 flex items-center justify-center text-[9px] text-black font-bold"
                style={{ width: `${(currentRec.buy / total) * 100}%` }}
              >
                {currentRec.buy}
              </div>
            )}
            {currentRec.hold > 0 && (
              <div
                className="bg-yellow-500 flex items-center justify-center text-[9px] text-black font-bold"
                style={{ width: `${(currentRec.hold / total) * 100}%` }}
              >
                {currentRec.hold}
              </div>
            )}
            {currentRec.sell > 0 && (
              <div
                className="bg-orange-500 flex items-center justify-center text-[9px] text-black font-bold"
                style={{ width: `${(currentRec.sell / total) * 100}%` }}
              >
                {currentRec.sell}
              </div>
            )}
            {currentRec.strongSell > 0 && (
              <div
                className="bg-red-500 flex items-center justify-center text-[9px] text-black font-bold"
                style={{ width: `${(currentRec.strongSell / total) * 100}%` }}
              >
                {currentRec.strongSell}
              </div>
            )}
          </div>
          <div className="flex justify-between text-[10px] text-retro-border-light">
            <span>Strong Buy</span>
            <span>Hold</span>
            <span>Strong Sell</span>
          </div>
        </div>
      )}

      {/* Price Targets */}
      {(data.targetLow != null || data.targetMean != null || data.targetHigh != null) && (
        <div className="px-3 py-2 border-b border-retro-border-light">
          <div className="text-retro-amber mb-1.5">Price Targets</div>
          {data.numberOfAnalysts != null && (
            <div className="text-retro-border-light mb-1">{data.numberOfAnalysts} analysts</div>
          )}
          {/* Visual range */}
          <div className="relative h-6 retro-sunken mb-2">
            {data.targetLow != null && data.targetHigh != null && data.currentPrice != null && (
              <>
                {/* Current price marker */}
                {(() => {
                  const range = data.targetHigh - data.targetLow;
                  if (range <= 0) return null;
                  const pct = Math.max(0, Math.min(100, ((data.currentPrice - data.targetLow) / range) * 100));
                  return (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-retro-cyan"
                      style={{ left: `${pct}%` }}
                      title={`Current: $${data.currentPrice.toFixed(2)}`}
                    />
                  );
                })()}
                {/* Mean marker */}
                {data.targetMean != null && (() => {
                  const range = data.targetHigh - data.targetLow;
                  if (range <= 0) return null;
                  const pct = ((data.targetMean - data.targetLow) / range) * 100;
                  return (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-retro-amber"
                      style={{ left: `${pct}%` }}
                      title={`Mean: $${data.targetMean.toFixed(2)}`}
                    />
                  );
                })()}
                {/* Range fill */}
                <div className="absolute inset-0 bg-retro-green opacity-10" />
              </>
            )}
          </div>
          <div className="space-y-0.5">
            <div className="flex justify-between">
              <span className="text-retro-red">Low</span>
              <span className="text-retro-text-bright font-mono">
                {data.targetLow != null ? `$${data.targetLow.toFixed(2)}` : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-retro-amber">Mean</span>
              <span className="text-retro-text-bright font-mono">
                {data.targetMean != null ? `$${data.targetMean.toFixed(2)}` : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-retro-green">High</span>
              <span className="text-retro-text-bright font-mono">
                {data.targetHigh != null ? `$${data.targetHigh.toFixed(2)}` : '—'}
              </span>
            </div>
            {data.currentPrice != null && (
              <div className="flex justify-between border-t border-retro-border-light pt-0.5 mt-1">
                <span className="text-retro-cyan">Current</span>
                <span className="text-retro-cyan font-mono">${data.currentPrice.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upgrade/Downgrade History */}
      {data.upgradeDowngradeHistory.length > 0 && (
        <div className="px-3 py-2">
          <div className="text-retro-amber mb-1.5">Recent Upgrades/Downgrades</div>
          <div className="space-y-1.5">
            {data.upgradeDowngradeHistory.slice(0, 8).map((item, i) => (
              <div key={i} className="border-b border-retro-border-dark pb-1">
                <div className="flex justify-between">
                  <span className="text-retro-text truncate max-w-[60%]">{item.firm}</span>
                  <span className="text-retro-border-light">{item.date}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={`${
                    item.action === 'up' ? 'text-retro-green' :
                    item.action === 'down' ? 'text-retro-red' :
                    'text-retro-amber'
                  }`}>
                    {item.action === 'up' ? '▲' : item.action === 'down' ? '▼' : '●'}
                  </span>
                  {item.fromGrade && (
                    <span className="text-retro-border-light">{item.fromGrade}</span>
                  )}
                  {item.fromGrade && item.toGrade && (
                    <span className="text-retro-border-light">→</span>
                  )}
                  <span className="text-retro-text-bright">{item.toGrade}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
