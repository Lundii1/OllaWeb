"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { WatchlistItem } from '../../lib/types';
import { 
  TrendingUp, 
  Search, 
  X, 
  ChevronLeft, 
  ChevronRight,
  Plus
} from "lucide-react";

const STORAGE_KEY = 'ollaweb-watchlist';

interface WatchlistProps {
  onSelectTicker: (ticker: string) => void;
  activeTicker: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function loadSavedTickers(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveTickers(tickers: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickers));
}

function formatVolume(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

export function Watchlist({ onSelectTicker, activeTicker, collapsed, onToggleCollapse }: WatchlistProps) {
  const [tickers, setTickers] = useState<string[]>([]);
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [addInput, setAddInput] = useState('');
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load saved tickers on mount
  useEffect(() => {
    setTickers(loadSavedTickers());
  }, []);

  // Fetch quotes for all tickers
  const fetchQuotes = useCallback(async (tickerList: string[]) => {
    if (tickerList.length === 0) {
      setItems([]);
      return;
    }
    try {
      const res = await fetch(`/api/finance/watchlist?tickers=${tickerList.join(',')}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error('Watchlist fetch error:', err);
    }
  }, []);

  // Fetch on tickers change
  useEffect(() => {
    if (tickers.length > 0) {
      setLoading(true);
      fetchQuotes(tickers).finally(() => setLoading(false));
    } else {
      setItems([]);
    }
  }, [tickers, fetchQuotes]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (tickers.length > 0) {
      intervalRef.current = setInterval(() => fetchQuotes(tickers), 30000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [tickers, fetchQuotes]);

  const addTicker = useCallback(() => {
    const t = addInput.trim().toUpperCase();
    if (!t || tickers.includes(t)) return;
    const newTickers = [...tickers, t];
    setTickers(newTickers);
    saveTickers(newTickers);
    setAddInput('');
  }, [addInput, tickers]);

  const removeTicker = useCallback((symbol: string) => {
    const newTickers = tickers.filter(t => t !== symbol);
    setTickers(newTickers);
    saveTickers(newTickers);
    setItems(prev => prev.filter(i => i.symbol !== symbol));
  }, [tickers]);

  const loadTrending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/finance/watchlist?trending=true');
      if (res.ok) {
        const data = await res.json();
        const trendingItems: WatchlistItem[] = data.items || [];
        const newTickers = trendingItems.map(i => i.symbol);
        setTickers(newTickers);
        saveTickers(newTickers);
        setItems(trendingItems);
      }
    } catch (err) {
      console.error('Trending fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  if (collapsed) {
    return (
      <div className="w-12 shrink-0 bg-[#171717] border-r border-[#333] flex flex-col items-center py-4 gap-4 z-20">
        <button
          onClick={onToggleCollapse}
          className="p-1 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-all"
        >
          <ChevronRight size={18} />
        </button>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] [writing-mode:vertical-lr] rotate-180">
            Market Watchlist
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-72 shrink-0 flex flex-col bg-[#171717] border-r border-[#333] z-20 overflow-hidden">
      {/* Header */}
      <div className="h-16 px-4 border-b border-[#333] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
           <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <TrendingUp size={16} className="text-blue-400" />
           </div>
           <span className="text-sm font-bold uppercase tracking-wider">Watchlist</span>
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-white transition-all"
        >
          <ChevronLeft size={18} />
        </button>
      </div>

      {/* Add ticker input */}
      <div className="p-4 space-y-3 shrink-0 border-b border-[#333]">
        <div className="relative group">
           <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 group-focus-within:text-white/50 transition-colors">
              <Search size={14} />
           </div>
           <input
             type="text"
             value={addInput}
             onChange={e => setAddInput(e.target.value.toUpperCase())}
             onKeyDown={e => e.key === 'Enter' && addTicker()}
             placeholder="Search & Add Ticker..."
             className="w-full bg-[#0a0a0a] border border-[#333] rounded-xl pl-9 pr-4 py-2 text-xs font-medium outline-none focus:ring-1 focus:ring-white/10 transition-all placeholder:text-muted-foreground/30"
           />
           {addInput && (
             <button
               onClick={addTicker}
               className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-white text-black hover:bg-neutral-200 transition-all shadow-lg"
             >
                <Plus size={12} />
             </button>
           )}
        </div>

        <button
          onClick={loadTrending}
          disabled={loading}
          className="w-full h-9 flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-40"
        >
          {loading ? (
             <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : (
             <TrendingUp size={14} />
          )}
          {loading ? 'Refining...' : 'Trending Now'}
        </button>
      </div>

      {/* Ticker list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {items.length > 0 ? (
          <div className="p-2 space-y-1">
            {items.map(item => (
              <div
                key={item.symbol}
                onClick={() => onSelectTicker(item.symbol)}
                className={`group flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border ${
                  item.symbol === activeTicker 
                    ? 'bg-[#212121] border-[#444] shadow-sm' 
                    : 'bg-transparent border-transparent hover:bg-white/5'
                }`}
              >
                <div className="flex-1 min-w-0">
                   <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold tracking-tight">{item.symbol}</span>
                      <span className="text-sm font-bold">${item.price.toFixed(2)}</span>
                   </div>
                   <div className="flex items-center justify-between">
                      <span className="text-[10px] items-center font-medium text-muted-foreground uppercase truncate pr-4">
                        {item.name || 'Stock Asset'}
                      </span>
                      <div className={`px-1.5 py-0.5 rounded-lg text-[10px] font-bold ${
                        item.changePercent >= 0 
                          ? 'bg-green-500/10 text-green-400' 
                          : 'bg-red-500/10 text-red-400'
                      }`}>
                        {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
                      </div>
                   </div>
                </div>
                
                <button
                  onClick={e => { e.stopPropagation(); removeTicker(item.symbol); }}
                  className="hidden group-hover:flex items-center justify-center w-6 h-6 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center opacity-30 gap-4">
             <div className="w-12 h-12 rounded-full border-2 border-dashed border-muted-foreground flex items-center justify-center">
                <Plus size={24} />
             </div>
             <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em]">List Empty</p>
                <p className="text-[10px] font-medium leading-relaxed mt-1">Start tracking assets by adding them above</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
