"use client";

import { useState, useEffect } from 'react';
import type { AnalystData } from '../../lib/types';

interface AnalystPanelProps {
  ticker: string;
}


import { 
  Users, 
  Target as TargetIcon, 
  TrendingUp, 
  Zap,
  ArrowRight,
  ChevronRight
} from 'lucide-react';

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
      <div className="h-full flex flex-col items-center justify-center p-8 text-center opacity-30 gap-4">
         <Users size={32} />
         <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Select ticker for analyst coverage</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-48 flex flex-col items-center justify-center gap-3">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Polling Analysts...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-medium">
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
                {data.targetLow != null && data.targetHigh != null && data.currentPrice != null && (
                  <>
                    {/* Range fill */}
                    <div className="absolute top-0 bottom-0 bg-blue-500/20 rounded-full" style={{
                       left: '10%',
                       right: '10%'
                    }} />
                    
                    {/* Markers */}
                    {data.targetMean != null && (
                      <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border-4 border-blue-600 shadow-lg z-10" style={{
                         left: `${((data.targetMean - data.targetLow) / (data.targetHigh - data.targetLow)) * 80 + 10}%`
                      }} />
                    )}
                    
                    <div className="absolute top-1/2 -translate-y-1/2 w-1.5 h-6 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)] z-20" style={{
                       left: `${((data.currentPrice - data.targetLow) / (data.targetHigh - data.targetLow)) * 80 + 10}%`
                    }} />
                  </>
                )}
             </div>

             <div className="grid grid-cols-3 gap-4 pt-2">
                <MetricBox label="Low" value={`$${data.targetLow?.toFixed(0)}`} color="text-red-400" />
                <MetricBox label="Mean" value={`$${data.targetMean?.toFixed(0)}`} color="text-white" />
                <MetricBox label="High" value={`$${data.targetHigh?.toFixed(0)}`} color="text-green-400" />
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
