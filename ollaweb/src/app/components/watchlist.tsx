"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { WatchlistItem } from '../../lib/types';

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
      <div className="w-8 shrink-0 bg-retro-surface retro-raised flex flex-col items-center pt-2">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="text-retro-amber text-xs retro-raised bg-retro-panel px-1 py-0.5 hover:text-retro-green"
          title="Expand Watchlist"
        >
          &gt;
        </button>
        <span className="text-retro-amber text-[10px] mt-2" style={{ writingMode: 'vertical-rl' }}>
          WATCHLIST
        </span>
      </div>
    );
  }

  return (
    <div className="w-56 shrink-0 flex flex-col bg-retro-surface retro-raised">
      {/* Header */}
      <div className="px-2 py-1.5 border-b border-retro-border-light flex items-center justify-between shrink-0">
        <span className="text-retro-amber text-sm font-bold">[WATCHLIST]</span>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="text-retro-text text-xs retro-raised bg-retro-panel px-1 hover:text-retro-green"
        >
          &lt;
        </button>
      </div>

      {/* Add ticker input */}
      <div className="px-2 py-1.5 flex gap-1 shrink-0 border-b border-retro-border-light">
        <input
          type="text"
          value={addInput}
          onChange={e => setAddInput(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && addTicker()}
          placeholder="ADD..."
          className="retro-sunken bg-retro-bg text-retro-green px-1.5 py-0.5 text-xs w-full outline-none uppercase"
        />
        <button
          type="button"
          onClick={addTicker}
          disabled={!addInput.trim()}
          className="retro-raised bg-retro-panel text-retro-green px-1.5 py-0.5 text-xs hover:bg-retro-blue disabled:opacity-40"
        >
          +
        </button>
      </div>

      {/* Trending button */}
      <div className="px-2 py-1 shrink-0">
        <button
          type="button"
          onClick={loadTrending}
          disabled={loading}
          className="retro-raised bg-retro-panel text-retro-cyan px-2 py-0.5 text-xs w-full hover:bg-retro-blue hover:text-retro-text-bright disabled:opacity-40"
        >
          {loading ? '[LOADING...]' : '[TRENDING]'}
        </button>
      </div>

      {/* Ticker list */}
      <div className="flex-1 overflow-y-auto">
        {items.length > 0 ? (
          <div className="text-xs">
            {/* Column headers */}
            <div className="px-2 py-0.5 flex items-center text-retro-border-light border-b border-retro-border-light">
              <span className="w-14">SYM</span>
              <span className="flex-1 text-right">PRICE</span>
              <span className="w-16 text-right">CHG%</span>
              <span className="w-5" />
            </div>
            {items.map(item => (
              <div
                key={item.symbol}
                onClick={() => onSelectTicker(item.symbol)}
                className={`px-2 py-1 flex items-center cursor-pointer hover:bg-retro-panel border-b border-retro-border-dark ${
                  item.symbol === activeTicker ? 'bg-retro-panel' : ''
                }`}
              >
                <span className="w-14 text-retro-cyan truncate">{item.symbol}</span>
                <span className="flex-1 text-right text-retro-text-bright">
                  {item.price.toFixed(2)}
                </span>
                <span className={`w-16 text-right ${item.changePercent >= 0 ? 'text-retro-green' : 'text-retro-red'}`}>
                  {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
                </span>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); removeTicker(item.symbol); }}
                  className="w-5 text-center text-retro-border-light hover:text-retro-red ml-1"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-2 py-4 text-center text-retro-border-light text-xs">
            {loading ? 'Loading...' : 'Add tickers or load trending'}
          </div>
        )}
      </div>
    </div>
  );
}
