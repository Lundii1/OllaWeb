"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, Plus, Search, TrendingUp, X } from "lucide-react";
import type { WatchlistItem } from "../../lib/types";
import { AppSidebar } from "./app-shell";

const STORAGE_KEY = "ollaweb-watchlist";

interface WatchlistProps {
  onSelectTicker: (ticker: string) => void;
  activeTicker: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  ticker: string;
  onTickerChange: (value: string) => void;
  onLoadTicker: () => void;
  tickerLoading?: boolean;
}

function loadSavedTickers(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function saveTickers(tickers: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tickers));
  } catch {
    // Local storage may be unavailable in hardened browser contexts.
  }
}

function formatWatchPrice(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function Watchlist({
  onSelectTicker,
  activeTicker,
  collapsed,
  onToggleCollapse,
  ticker,
  onTickerChange,
  onLoadTicker,
  tickerLoading = false,
}: WatchlistProps) {
  const [tickers, setTickers] = useState<string[]>([]);
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [addInput, setAddInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const requestControllerRef = useRef<AbortController | null>(null);

  useEffect(() => setTickers(loadSavedTickers()), []);

  const fetchQuotes = useCallback(async (tickerList: string[]) => {
    requestControllerRef.current?.abort();
    if (tickerList.length === 0) {
      setItems([]);
      return;
    }

    const controller = new AbortController();
    requestControllerRef.current = controller;
    try {
      const response = await fetch(
        `/api/finance/watchlist?tickers=${tickerList.join(",")}`,
        { signal: controller.signal },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to refresh watchlist");
      setItems(body.items || []);
      setStatus("Watchlist refreshed");
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus(error instanceof Error ? error.message : "Unable to refresh watchlist");
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void fetchQuotes(tickers).finally(() => setLoading(false));
    const interval = window.setInterval(() => void fetchQuotes(tickers), 30000);
    return () => {
      window.clearInterval(interval);
      requestControllerRef.current?.abort();
    };
  }, [fetchQuotes, tickers]);

  const addTicker = useCallback(
    (event?: FormEvent) => {
      event?.preventDefault();
      const symbol = addInput.trim().toUpperCase();
      if (!/^[A-Z0-9.\-^]{1,10}$/.test(symbol)) {
        setStatus("Enter a valid ticker to track");
        return;
      }
      if (tickers.includes(symbol)) {
        setStatus(`${symbol} is already in your watchlist`);
        return;
      }
      const updated = [...tickers, symbol];
      setTickers(updated);
      saveTickers(updated);
      setAddInput("");
      setStatus(`${symbol} added to watchlist`);
    },
    [addInput, tickers],
  );

  const removeTicker = useCallback(
    (symbol: string) => {
      const updated = tickers.filter((item) => item !== symbol);
      setTickers(updated);
      setItems((current) => current.filter((item) => item.symbol !== symbol));
      saveTickers(updated);
      setStatus(`${symbol} removed from watchlist`);
    },
    [tickers],
  );

  const loadTrending = useCallback(async () => {
    setLoading(true);
    setStatus("Loading trending tickers");
    try {
      const response = await fetch("/api/finance/watchlist?trending=true");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load trending tickers");
      const trendingItems: WatchlistItem[] = (body.items || []).filter(
        (item: WatchlistItem) => /^[A-Z0-9.\-^]{1,10}$/.test(item.symbol),
      );
      if (trendingItems.length === 0) {
        throw new Error("No trending tickers are available right now");
      }
      const trendingTickers = trendingItems.map((item) => item.symbol);
      setTickers(trendingTickers);
      setItems(trendingItems);
      saveTickers(trendingTickers);
      setStatus("Trending tickers loaded");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Unable to load trending tickers");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    onLoadTicker();
  };

  return (
    <AppSidebar
      open={!collapsed}
      onOpenChange={() => onToggleCollapse()}
      currentPage="finance"
      expandedLabel="Hide market watchlist"
      collapsedLabel="Show market watchlist"
      top={
        <form onSubmit={handleSearchSubmit} className="flex min-w-0 items-center gap-1.5">
          <label htmlFor="finance-ticker-search" className="sr-only">
            Load a ticker
          </label>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              id="finance-ticker-search"
              value={ticker}
              onChange={(event) => onTickerChange(event.target.value.toUpperCase())}
              placeholder="Load ticker"
              maxLength={10}
              className="w-full rounded-lg border border-white/10 bg-black/30 py-2 pl-8 pr-2 text-sm uppercase outline-none placeholder:normal-case placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-white/30"
            />
          </div>
          <button
            type="submit"
            disabled={!ticker.trim() || tickerLoading}
            aria-label="Load ticker"
            title="Load ticker"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            {tickerLoading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Search className="size-4" aria-hidden="true" />}
          </button>
        </form>
      }
    >
      <div className="border-b border-white/10 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-cyan-300" aria-hidden="true" />
            <h2 className="text-sm font-medium">Watchlist</h2>
          </div>
          <span className="text-xs text-muted-foreground">{tickers.length}</span>
        </div>
        <form onSubmit={addTicker} className="flex gap-1.5">
          <label htmlFor="watchlist-add" className="sr-only">
            Add ticker to watchlist
          </label>
          <input
            id="watchlist-add"
            value={addInput}
            onChange={(event) => setAddInput(event.target.value.toUpperCase())}
            placeholder="Track a ticker"
            maxLength={10}
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm uppercase outline-none placeholder:normal-case placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-white/30"
          />
          <button
            type="submit"
            disabled={!addInput.trim()}
            aria-label="Add ticker to watchlist"
            className="inline-flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 transition-colors hover:bg-white/10 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </form>
        <button
          type="button"
          onClick={loadTrending}
          disabled={loading}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <TrendingUp className="size-4" aria-hidden="true" />}
          Trending now
        </button>
        <p className="sr-only" aria-live="polite">{status}</p>
      </div>

      {items.length > 0 ? (
        <ul className="space-y-1 p-2" aria-label="Tracked tickers">
          {items.map((item) => {
            const positive = item.changePercent >= 0;
            const active = item.symbol === activeTicker;
            return (
              <li key={item.symbol} className={`group flex items-center rounded-lg border transition-colors ${active ? "border-white/10 bg-white/10" : "border-transparent hover:bg-white/5"}`}>
                <button
                  type="button"
                  onClick={() => onSelectTicker(item.symbol)}
                  aria-current={active ? "true" : undefined}
                  className="min-w-0 flex-1 rounded-lg p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/30"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium">{item.symbol}</span>
                    <span className="text-sm font-medium tabular-nums">{formatWatchPrice(item.price)}</span>
                  </span>
                  <span className="mt-1 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-muted-foreground">{item.name || "Stock"}</span>
                    <span className={`shrink-0 font-medium ${positive ? "text-emerald-400" : "text-red-400"}`}>
                      {positive ? "▲" : "▼"} {positive ? "+" : ""}{item.changePercent.toFixed(2)}%
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => removeTicker(item.symbol)}
                  aria-label={`Remove ${item.symbol} from watchlist`}
                  className="mr-2 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-60 transition-colors hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
          <div className="flex size-10 items-center justify-center rounded-full border border-dashed border-white/20">
            <Plus className="size-4" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No tracked tickers</p>
            <p className="mt-1 text-xs">Add one above or load today&apos;s trending list.</p>
          </div>
        </div>
      )}
    </AppSidebar>
  );
}
