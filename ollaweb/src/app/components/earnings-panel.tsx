"use client";

import { 
  Calendar, 
  History, 
  BarChart3, 
  ArrowUpRight, 
  ArrowDownRight,
  Target
} from 'lucide-react';
import type { EarningsData } from '../../lib/types';

export type EarningsPanelData = EarningsData;

export interface EarningsPanelProps {
  ticker: string;
  data?: EarningsData | null;
  loading?: boolean;
  error?: string | null;
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function EarningsPanel({
  ticker,
  data = null,
  loading = false,
  error = null,
}: EarningsPanelProps) {

  if (!ticker) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center opacity-30 gap-4">
         <Calendar size={32} />
         <p className="text-sm">Select a ticker to view earnings</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="h-48 flex flex-col items-center justify-center gap-3">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground">Loading earnings…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-medium">
        Error: {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-col gap-6 py-2 pb-6">
      {/* Next Earnings */}
      {data.nextEarningsDate && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 transition-all hover:bg-white/[0.07]">
          <div className="flex items-center gap-2 text-muted-foreground mb-3">
             <Calendar size={14} />
             <span className="text-[10px] font-bold uppercase tracking-widest">Upcoming Release</span>
          </div>
          <div className="flex justify-between items-end">
            <div className="text-xl font-bold tracking-tight">{data.nextEarningsDate}</div>
            <div className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
               daysUntil(data.nextEarningsDate) > 0 ? 'bg-blue-500/10 text-blue-400' : 'bg-green-500/10 text-green-400'
            }`}>
              {daysUntil(data.nextEarningsDate) > 0
                ? `In ${daysUntil(data.nextEarningsDate)} Days`
                : 'Today'}
            </div>
          </div>
        </div>
      )}

      {/* EPS History */}
      {data.history.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground px-1">
             <History size={14} />
             <span className="text-[10px] font-bold uppercase tracking-widest">EPS History</span>
          </div>
          <div className="space-y-2">
            <div className="flex px-3 text-[10px] font-bold uppercase text-muted-foreground/50 tracking-wider">
               <span className="w-16">Period</span>
               <span className="w-14 text-right">Est</span>
               <span className="w-14 text-right">Act</span>
               <span className="flex-1 text-right">Surprise</span>
            </div>
            {data.history.map((h, i) => (
              <div key={i} className="flex items-center px-3 py-2 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/5 transition-colors">
                <span className="w-16 text-xs font-bold">{h.date || h.quarter}</span>
                <span className="w-14 text-right text-xs font-mono text-muted-foreground">
                  {h.epsEstimate != null ? h.epsEstimate.toFixed(2) : '—'}
                </span>
                <span className="w-14 text-right text-xs font-mono font-bold">
                  {h.epsActual != null ? h.epsActual.toFixed(2) : '—'}
                </span>
                <div className={`flex-1 text-right flex justify-end`}>
                   <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono min-w-[50px] text-center ${
                      h.surprisePercent != null
                        ? h.surprisePercent >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                        : 'text-muted-foreground'
                   }`}>
                      {h.surprisePercent != null
                        ? `${h.surprisePercent >= 0 ? '+' : ''}${h.surprisePercent.toFixed(1)}%`
                        : '—'}
                   </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Forward Estimates */}
      {data.trend.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground px-1">
             <BarChart3 size={14} />
             <span className="text-[10px] font-bold uppercase tracking-widest">Forward Estimates</span>
          </div>
          <div className="space-y-2">
            <div className="flex px-3 text-[10px] font-bold uppercase text-muted-foreground/50 tracking-wider">
               <span className="w-16">Period</span>
               <span className="w-14 text-right">EPS Est</span>
               <span className="flex-1 text-right">Y/Y Growth</span>
            </div>
            {data.trend.map((t, i) => (
              <div key={i} className="flex items-center px-3 py-2 bg-white/[0.02] border border-white/5 rounded-xl">
                <span className="w-16 text-xs font-bold">{t.period}</span>
                <span className="w-14 text-right text-xs font-mono font-bold">
                  {t.epsEstimate != null ? t.epsEstimate.toFixed(2) : '—'}
                </span>
                <div className="flex-1 text-right flex justify-end items-center gap-1.5 font-mono text-xs">
                   {t.growth != null && (
                      t.growth >= 0 
                        ? <ArrowUpRight size={10} className="text-green-400" />
                        : <ArrowDownRight size={10} className="text-red-400" />
                   )}
                   <span className={t.growth != null ? (t.growth >= 0 ? 'text-green-400' : 'text-red-400') : 'text-muted-foreground'}>
                      {t.growth != null ? `${t.growth >= 0 ? '+' : ''}${t.growth.toFixed(1)}%` : '—'}
                   </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EPS Revisions */}
      {data.epsRevisions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground px-1">
             <Target size={14} />
             <span className="text-[10px] font-bold uppercase tracking-widest">EPS Revisions (30d)</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {data.epsRevisions.map((r, i) => (
              <div key={i} className="p-3 bg-[#111] border border-white/5 rounded-2xl">
                <div className="text-[10px] font-bold text-muted-foreground uppercase mb-2 tracking-wider">{r.period}</div>
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      <span className="text-xs font-bold text-green-400">{r.upLast30 ?? 0}</span>
                   </div>
                   <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-red-500">{r.downLast30 ?? 0}</span>
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
