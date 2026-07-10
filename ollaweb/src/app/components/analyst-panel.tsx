"use client";

import type { AnalystData } from '../../lib/types';
import { formatCurrency } from '../../lib/finance-utils';

import { 
  Users, 
  Target as TargetIcon, 
  TrendingUp, 
  Zap,
  ArrowRight,
  ChevronRight
} from 'lucide-react';

export type AnalystPanelData = AnalystData;

export interface AnalystPanelProps {
  ticker: string;
  data?: AnalystData | null;
  loading?: boolean;
  error?: string | null;
  currency?: string | null;
}

export function AnalystPanel({
  ticker,
  data = null,
  loading = false,
  error = null,
  currency = 'USD',
}: AnalystPanelProps) {

  if (!ticker) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center opacity-30 gap-4">
         <Users size={32} />
         <p className="text-sm">Select a ticker for analyst coverage</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="h-48 flex flex-col items-center justify-center gap-3">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground">Loading analyst coverage…</span>
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

  // Current month recommendation
  const currentRec = data.recommendations?.[0];
  const total = currentRec
    ? currentRec.strongBuy + currentRec.buy + currentRec.hold + currentRec.sell + currentRec.strongSell
    : 0;
  const hasTargetRange = data.targetLow != null
    && data.targetHigh != null
    && data.targetHigh > data.targetLow;
  const targetPosition = (value: number | null) => {
    if (!hasTargetRange || value == null || data.targetLow == null || data.targetHigh == null) return null;
    const normalized = ((value - data.targetLow) / (data.targetHigh - data.targetLow)) * 80 + 10;
    return Math.min(90, Math.max(10, normalized));
  };
  const meanPosition = targetPosition(data.targetMean);
  const currentPosition = targetPosition(data.currentPrice);
  const formatTarget = (value: number | null) => formatCurrency(value, currency);

  return (
    <div className="flex flex-col gap-6 py-2 pb-6">
      {/* Consensus Rating Bar */}
      {currentRec && total > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground px-1">
             <Users size={14} />
             <span className="text-[10px] font-bold uppercase tracking-widest">Market Sentiment</span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 transition-all">
             <div className="flex h-3 rounded-full overflow-hidden mb-4 bg-white/5">
                <div style={{ width: `${(currentRec.strongBuy / total) * 100}%` }} className="h-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]" />
                <div style={{ width: `${(currentRec.buy / total) * 100}%` }} className="h-full bg-green-400 opacity-80" />
                <div style={{ width: `${(currentRec.hold / total) * 100}%` }} className="h-full bg-yellow-500 opacity-60" />
                <div style={{ width: `${(currentRec.sell / total) * 100}%` }} className="h-full bg-orange-500 opacity-40" />
                <div style={{ width: `${(currentRec.strongSell / total) * 100}%` }} className="h-full bg-red-500 opacity-20" />
             </div>
             <div className="grid grid-cols-3 gap-2 text-[10px] font-bold uppercase tracking-wider">
                <div className="flex flex-col items-start">
                   <span className="text-green-400 mb-0.5">Bullish</span>
                   <span className="text-lg tracking-tight text-white">{currentRec.strongBuy + currentRec.buy}</span>
                </div>
                <div className="flex flex-col items-center">
                   <span className="text-muted-foreground mb-0.5">Neutral</span>
                   <span className="text-lg tracking-tight text-white">{currentRec.hold}</span>
                </div>
                <div className="flex flex-col items-end">
                   <span className="text-red-400 mb-0.5">Bearish</span>
                   <span className="text-lg tracking-tight text-white">{currentRec.sell + currentRec.strongSell}</span>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Price Targets */}
      {(data.targetLow != null || data.targetMean != null || data.targetHigh != null) && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground px-1">
             <TargetIcon size={14} />
             <span className="text-[10px] font-bold uppercase tracking-widest">Price Objectives</span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4">
             {data.numberOfAnalysts != null && (
               <div className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest text-center">
                  Based on {data.numberOfAnalysts} professional forecasts
               </div>
             )}
             
             <div className="relative h-2 bg-white/5 rounded-full mx-2 border border-white/5">
                {hasTargetRange && currentPosition != null && (
                  <>
                    {/* Range fill */}
                    <div className="absolute top-0 bottom-0 bg-blue-500/20 rounded-full" style={{
                       left: '10%',
                       right: '10%'
                    }} />
                    
                    {/* Markers */}
                    {meanPosition != null && (
                      <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border-4 border-blue-600 shadow-lg z-10" style={{
                         left: `${meanPosition}%`
                      }} />
                    )}
                    
                    <div className="absolute top-1/2 -translate-y-1/2 w-1.5 h-6 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)] z-20" style={{
                       left: `${currentPosition}%`
                    }} />
                  </>
                )}
             </div>

             <div className="grid grid-cols-3 gap-4 pt-2">
                <MetricBox label="Low" value={formatTarget(data.targetLow)} color="text-red-400" />
                <MetricBox label="Mean" value={formatTarget(data.targetMean)} color="text-white" />
                <MetricBox label="High" value={formatTarget(data.targetHigh)} color="text-green-400" />
             </div>
          </div>
        </div>
      )}

      {/* Upgrade/Downgrade History */}
      {data.upgradeDowngradeHistory.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground px-1">
             <Zap size={14} />
             <span className="text-[10px] font-bold uppercase tracking-widest">Recent Activity</span>
          </div>
          <div className="space-y-2">
            {data.upgradeDowngradeHistory.slice(0, 6).map((item, i) => (
              <div key={i} className="group p-3 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/5 transition-all">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] font-bold uppercase text-blue-400 tracking-wider truncate max-w-[140px]">{item.firm}</span>
                  <span className="text-[9px] font-medium text-muted-foreground">{item.date}</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className={`flex items-center justify-center w-5 h-5 rounded-lg ${
                      item.action === 'up' ? 'bg-green-500/10 text-green-400' :
                      item.action === 'down' ? 'bg-red-500/10 text-red-400' :
                      'bg-white/5 text-muted-foreground'
                   }`}>
                      {item.action === 'up' ? <TrendingUp size={12}/> : <ArrowRight size={12}/>}
                   </div>
                   <div className="flex items-center gap-2 text-xs font-bold leading-none">
                      {item.fromGrade && <span className="opacity-40">{item.fromGrade}</span>}
                      {item.fromGrade && <ChevronRight size={10} className="opacity-20" />}
                      <span className="text-white">{item.toGrade}</span>
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

function MetricBox({ label, value, color }: { label: string; value: string; color: string }) {
   return (
      <div className="flex flex-col items-center">
         <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest mb-1">{label}</span>
         <span className={`text-sm font-bold tracking-tight ${color}`}>{value}</span>
      </div>
   );
}
