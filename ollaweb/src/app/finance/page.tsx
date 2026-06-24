"use client";

import { Suspense, useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  Search, 
  TrendingUp, 
  MessageSquare, 
  BarChart4, 
  Newspaper, 
  AlertCircle, 
  X, 
  Send,
  Share2,
  Check,
  Briefcase,
  BarChart3,
  Clock,
  DollarSign
} from "lucide-react";
import { StockChart } from '../components/stock-chart';
import { Watchlist } from '../components/watchlist';
import { AppNav } from '../components/app-nav';
import { FinancialStatements } from '../components/financial-statements';
import { EarningsPanel } from '../components/earnings-panel';
import { AnalystPanel } from '../components/analyst-panel';
import { CodeBlock } from '../components/code-block';
import { AVAILABLE_MODELS, COMPARISON_COLORS } from '../../lib/types';
import { trackGrowthMetric } from '../../lib/growth-metrics';
import type { ChartDataPoint, QuoteData, ChartPeriod, NewsItem, KeyMetrics, IndicatorConfig, ComparisonTicker } from '../../lib/types';

const PERIODS: ChartPeriod[] = ['1d', '5d', '1mo', '3mo', '1y', '5y'];
const PERIOD_LABELS: Record<ChartPeriod, string> = {
  '1d': '1D', '5d': '5D', '1mo': '1M', '3mo': '3M', '1y': '1Y', '5y': '5Y',
};

type BottomTab = 'chat' | 'financials' | 'news';
type RightTab = 'metrics' | 'earnings' | 'analyst';
type ShareStatus = 'idle' | 'copied' | 'error';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

function timeAgo(unixSeconds: number): string {
  if (!unixSeconds) return '';
  const now = Math.floor(Date.now() / 1000);
  const diff = now - unixSeconds;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 604800)}w ago`;
}

function formatLargeNumber(n: number | null): string {
  if (n == null) return 'N/A';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function formatVolume(n: number | null): string {
  if (n == null) return 'N/A';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

const DEFAULT_INDICATORS: IndicatorConfig = {
  sma: false, ema: false, rsi: false, macd: false, bollinger: false,
};

function FinancePageContent() {
  const searchParams = useSearchParams();

  // Stock state
  const [ticker, setTicker] = useState('');
  const [activeTicker, setActiveTicker] = useState('');
  const [period, setPeriod] = useState<ChartPeriod>('1mo');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);

  // News & metrics state
  const [news, setNews] = useState<NewsItem[]>([]);
  const [metrics, setMetrics] = useState<KeyMetrics | null>(null);

  // Data for AI context (fetched in background when ticker loads)
  const earningsDataRef = useRef<any>(null);
  const analystDataRef = useRef<any>(null);
  const financialsDataRef = useRef<any>(null);

  // Chat state
  const [model, setModel] = useState('gemma4:e4b');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isResponding, setIsResponding] = useState(false);

  // Technical indicators
  const [indicators, setIndicators] = useState<IndicatorConfig>(DEFAULT_INDICATORS);

  // Comparison
  const [compareInput, setCompareInput] = useState('');
  const [comparisonData, setComparisonData] = useState<ComparisonTicker[]>([]);

  // Watchlist
  const [watchlistCollapsed, setWatchlistCollapsed] = useState(false);

  // Tab state
  const [bottomTab, setBottomTab] = useState<BottomTab>('chat');
  const [rightTab, setRightTab] = useState<RightTab>('metrics');
  const [shareStatus, setShareStatus] = useState<ShareStatus>('idle');
  const [shareBanner, setShareBanner] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const sharedLinkAppliedRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch stock data
  const fetchQuote = useCallback(async (tickerSymbol: string, chartPeriod: ChartPeriod) => {
    if (!tickerSymbol.trim()) return;
    setChartLoading(true);
    setChartError(null);

    try {
      const res = await fetch(`/api/finance/quote?ticker=${encodeURIComponent(tickerSymbol)}&period=${chartPeriod}`);
      const data = await res.json();

      if (!res.ok) {
        setChartError(data.error || 'Failed to load stock data');
        setChartData([]);
        setQuoteData(null);
        setNews([]);
        setMetrics(null);
        return;
      }

      setChartData(data.chartData);
      setQuoteData({
        symbol: data.symbol,
        name: data.name,
        price: data.price,
        change: data.change,
        changePercent: data.changePercent,
        currency: data.currency,
      });
      setActiveTicker(data.symbol);
      setNews(data.news || []);
      setMetrics(data.metrics || null);

      // Fetch earnings, analyst, and financials in background for AI context
      const sym = data.symbol;
      Promise.all([
        fetch(`/api/finance/earnings?ticker=${encodeURIComponent(sym)}`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`/api/finance/analysis?ticker=${encodeURIComponent(sym)}`).then(r => r.ok ? r.json() : null).catch(() => null),
        Promise.all([
          fetch(`/api/finance/fundamentals?ticker=${encodeURIComponent(sym)}&statement=income&periodType=annual`).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`/api/finance/fundamentals?ticker=${encodeURIComponent(sym)}&statement=balance&periodType=annual`).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`/api/finance/fundamentals?ticker=${encodeURIComponent(sym)}&statement=cashflow&periodType=annual`).then(r => r.ok ? r.json() : null).catch(() => null),
        ]),
      ]).then(([earnings, analyst, [income, balance, cashflow]]) => {
        earningsDataRef.current = earnings;
        analystDataRef.current = analyst;
        financialsDataRef.current = { income, balance, cashflow };
      });
    } catch (err) {
      setChartError(err instanceof Error ? err.message : 'Network error');
      setChartData([]);
      setQuoteData(null);
      setNews([]);
      setMetrics(null);
    } finally {
      setChartLoading(false);
    }
  }, []);

  const resetTickerContext = useCallback(() => {
    setMessages([]);
    setComparisonData([]);
    earningsDataRef.current = null;
    analystDataRef.current = null;
    financialsDataRef.current = null;
  }, []);

  const handleLoadTicker = useCallback(() => {
    if (!ticker.trim()) return;
    resetTickerContext();
    fetchQuote(ticker.trim(), period);
  }, [ticker, period, fetchQuote, resetTickerContext]);

  // Load ticker from watchlist
  const handleWatchlistSelect = useCallback((symbol: string) => {
    setTicker(symbol);
    resetTickerContext();
    fetchQuote(symbol, period);
  }, [period, fetchQuote, resetTickerContext]);

  useEffect(() => {
    if (sharedLinkAppliedRef.current || !searchParams) return;

    const sharedTicker = searchParams.get('sym')?.trim().toUpperCase();
    if (!sharedTicker || !/^[A-Z0-9.\-^]{1,10}$/.test(sharedTicker)) return;

    const sharedPeriod = searchParams.get('p');
    const parsedPeriod = sharedPeriod && PERIODS.includes(sharedPeriod as ChartPeriod)
      ? sharedPeriod as ChartPeriod
      : '1mo';
    const sharedPrompt = searchParams.get('q')?.trim();

    sharedLinkAppliedRef.current = true;
    setTicker(sharedTicker);
    setPeriod(parsedPeriod);
    resetTickerContext();
    fetchQuote(sharedTicker, parsedPeriod);

    if (sharedPrompt) {
      setBottomTab('chat');
      setChatInput(sharedPrompt.slice(0, 500));
    }

    setShareBanner(sharedPrompt
      ? `Loaded shared setup for ${sharedTicker} with a ready-to-run prompt.`
      : `Loaded shared setup for ${sharedTicker}.`);
    trackGrowthMetric('share_link_opened', {
      ticker: sharedTicker,
      period: parsedPeriod,
      hasPrompt: Boolean(sharedPrompt),
    });
  }, [searchParams, fetchQuote, resetTickerContext]);

  useEffect(() => {
    if (!shareBanner) return;
    const timer = setTimeout(() => setShareBanner(null), 4500);
    return () => clearTimeout(timer);
  }, [shareBanner]);

  const handlePeriodChange = useCallback((p: ChartPeriod) => {
    setPeriod(p);
    if (activeTicker) {
      fetchQuote(activeTicker, p);
      // Re-fetch comparison data for new period
      if (comparisonData.length > 0) {
        const symbols = comparisonData.map(c => c.symbol);
        Promise.all(
          symbols.map(async (sym, i) => {
            try {
              const res = await fetch(`/api/finance/quote?ticker=${encodeURIComponent(sym)}&period=${p}`);
              const data = await res.json();
              if (res.ok && data.chartData) {
                return {
                  symbol: sym,
                  data: data.chartData,
                  color: COMPARISON_COLORS[i % COMPARISON_COLORS.length] as string,
                  changePercent: data.changePercent || 0,
                } as ComparisonTicker;
              }
            } catch {}
            return null;
          })
        ).then(results => {
          setComparisonData(results.filter((r): r is ComparisonTicker => r != null));
        });
      }
    }
  }, [activeTicker, fetchQuote, comparisonData]);

  // Toggle indicator
  const toggleIndicator = useCallback((key: keyof IndicatorConfig) => {
    setIndicators(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Add comparison ticker
  const addComparison = useCallback(async () => {
    const sym = compareInput.trim().toUpperCase();
    if (!sym || comparisonData.length >= 4 || sym === activeTicker) return;
    if (comparisonData.some(c => c.symbol === sym)) return;

    try {
      const res = await fetch(`/api/finance/quote?ticker=${encodeURIComponent(sym)}&period=${period}`);
      const data = await res.json();
      if (res.ok && data.chartData) {
        setComparisonData(prev => [...prev, {
          symbol: sym,
          data: data.chartData,
          color: COMPARISON_COLORS[prev.length % COMPARISON_COLORS.length] as string,
          changePercent: data.changePercent || 0,
        }]);
      }
    } catch {}
    setCompareInput('');
  }, [compareInput, comparisonData, activeTicker, period]);

  const removeComparison = useCallback((symbol: string) => {
    setComparisonData(prev => prev.filter(c => c.symbol !== symbol));
  }, []);

  const handleShareSetup = useCallback(async () => {
    if (!activeTicker || typeof window === 'undefined') return;

    const latestUserPrompt = [...messages]
      .reverse()
      .find((m) => m.role === 'user')
      ?.content
      ?.trim();
    const promptToShare = (latestUserPrompt || chatInput.trim()).slice(0, 500);

    const shareUrl = new URL('/finance', window.location.origin);
    shareUrl.searchParams.set('sym', activeTicker);
    shareUrl.searchParams.set('p', period);
    if (promptToShare) {
      shareUrl.searchParams.set('q', promptToShare);
    }

    try {
      await navigator.clipboard.writeText(shareUrl.toString());
      setShareStatus('copied');
      setShareBanner('Share link copied. Teammates will land on this ticker and prompt.');
      trackGrowthMetric('share_link_created', {
        ticker: activeTicker,
        period,
        hasPrompt: Boolean(promptToShare),
      });
    } catch (err) {
      console.error('Failed to copy share link:', err);
      setShareStatus('error');
      setShareBanner('Could not copy share link. Check clipboard permissions.');
    }
  }, [activeTicker, messages, chatInput, period]);

  useEffect(() => {
    if (shareStatus === 'idle') return;
    const timer = setTimeout(() => setShareStatus('idle'), 2500);
    return () => clearTimeout(timer);
  }, [shareStatus]);

  // Send chat message
  const handleSendMessage = useCallback(async () => {
    if (!chatInput.trim() || isResponding) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsResponding(true);

    const assistantId = Date.now().toString() + '-assistant';

    try {
      const formData = new FormData();
      formData.append('messages', JSON.stringify([...messages, userMessage]));
      formData.append('model', model);
      formData.append('ticker', activeTicker);

      // Bundle all financial data for AI context
      const financialData: any = {};
      if (quoteData) financialData.quote = quoteData;
      if (metrics) financialData.metrics = metrics;
      if (news.length > 0) financialData.news = news;
      if (earningsDataRef.current) financialData.earnings = earningsDataRef.current;
      if (analystDataRef.current) financialData.analyst = analystDataRef.current;
      if (financialsDataRef.current) financialData.financials = financialsDataRef.current;
      formData.append('financialData', JSON.stringify(financialData));

      const response = await fetch('/api/finance/chat', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }));
        setMessages(prev => [...prev, {
          id: assistantId,
          role: 'assistant',
          content: `Error: ${err.error || 'Unknown error'}`,
        }]);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let responseText = '';
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        responseText += decoder.decode(value || new Uint8Array());

        setMessages(prev => {
          const idx = prev.findIndex(m => m.id === assistantId);
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], content: responseText };
            return updated;
          }
          return [...prev, { id: assistantId, role: 'assistant', content: responseText }];
        });
      }
    } catch (error) {
      console.error('Finance chat error:', error);
      setMessages(prev => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }]);
    } finally {
      setIsResponding(false);
    }
  }, [chatInput, isResponding, messages, model, activeTicker, quoteData, metrics, news]);

  const renderMessageContent = (content: string) => {
    return content.split(/(```[\s\S]*?```|<think>[\s\S]*?<\/think>)/g).map((part, index) => {
      if (part.startsWith('```')) {
        const match = part.match(/```(\w+)?\n([\s\S]+?)```/);
        return match ? (
          <CodeBlock key={index} code={match[2].trim()} language={match[1] || 'text'} />
        ) : part;
      }
      if (part.trim().startsWith('<think>')) {
        const thinkContent = part.trim().slice(7, -8);
        if (thinkContent.length <= 2) return null;
        return (
          <div key={index} className="bg-[#2f2f2f] border border-[#404040] rounded-lg p-2.5 italic text-amber-400/90 text-sm">
            {'[Thinking] ' + thinkContent}
          </div>
        );
      }
      return part.split('**').map((text, i) =>
        i % 2 ? <strong key={`${index}-${i}`}>{text}</strong> : text
      );
    });
  };

  const MetricRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-amber-400/90 text-xs">{label}</span>
      <span className="text-foreground text-xs font-mono">{value}</span>
    </div>
  );

  // Indicator toggle button helper
  const IndicatorBtn = ({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
        active
          ? 'bg-[#404040] text-foreground'
          : 'bg-[#2f2f2f] text-muted-foreground hover:text-foreground hover:bg-[#3a3a3a] border border-[#404040]'
      }`}
      style={active ? { color } : undefined}
    >
      {label}
    </button>
  );

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-foreground font-sans selection:bg-white/10 overflow-hidden relative">
      <Watchlist
        onSelectTicker={handleWatchlistSelect}
        activeTicker={activeTicker}
        collapsed={watchlistCollapsed}
        onToggleCollapse={() => setWatchlistCollapsed(prev => !prev)}
      />

      <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a] relative z-10">
        {/* Ticker Toolbar */}
        <header className="h-16 border-b border-[#333] flex items-center justify-between px-6 bg-[#0a0a0a]/50 backdrop-blur-md z-30 shrink-0">
          <div className="flex items-center gap-4 flex-1">
             <Link href="/" className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold text-lg hover:scale-105 transition-transform shrink-0">V</Link>
             <AppNav current="finance" />
             <div className="h-6 w-[1px] bg-[#333]" />
             <div className="flex items-center gap-2 bg-[#171717] border border-[#333] rounded-xl px-3 py-1.5 focus-within:ring-1 focus-within:ring-white/20 transition-all">
                <span className="text-muted-foreground"><Search size={16} /></span>
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleLoadTicker()}
                  placeholder="Enter ticker (e.g. AAPL)"
                  className="bg-transparent border-none outline-none text-sm w-32 uppercase font-medium placeholder:text-muted-foreground/30"
                />
             </div>
             
             <button
               onClick={handleLoadTicker}
               disabled={!ticker.trim() || chartLoading}
               className="h-10 px-4 bg-white text-black rounded-xl text-sm font-semibold hover:bg-neutral-200 transition-all disabled:opacity-30"
             >
                {chartLoading ? 'Loading...' : 'Load'}
             </button>

             <button
               onClick={handleShareSetup}
               disabled={!activeTicker}
               className="h-10 px-3 rounded-xl text-xs font-bold uppercase tracking-wider border border-[#333] bg-[#171717] hover:bg-[#212121] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
               title={activeTicker ? 'Copy a link that preloads this ticker setup' : 'Load a ticker first'}
             >
               {shareStatus === 'copied' ? <Check size={14} className="text-green-400" /> : <Share2 size={14} />}
               {shareStatus === 'copied' ? 'Copied' : shareStatus === 'error' ? 'Retry Share' : 'Share Setup'}
             </button>

             <div className="h-6 w-[1px] bg-[#333] mx-2" />

             <div className="flex items-center gap-1 bg-[#171717]/50 rounded-xl p-1 border border-[#333]">
                {PERIODS.map((p) => (
                  <button
                    key={p}
                    onClick={() => handlePeriodChange(p)}
                    disabled={!activeTicker}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      period === p 
                        ? 'bg-[#2f2f2f] text-white shadow-sm' 
                        : 'text-muted-foreground hover:text-white'
                    }`}
                  >
                    {PERIOD_LABELS[p]}
                  </button>
                ))}
             </div>
          </div>

          {quoteData && (
            <div className="flex items-center gap-4 pl-4 border-l border-[#333]">
               <div className="text-right">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">{quoteData.symbol}</div>
                  <div className="text-xl font-bold leading-none tracking-tight">${quoteData.price.toFixed(2)}</div>
               </div>
               <div className={`flex flex-col items-end px-3 py-1.5 rounded-xl border ${
                  quoteData.change >= 0 
                    ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
               }`}>
                  <span className="text-xs font-bold leading-none">
                     {quoteData.change >= 0 ? '+' : ''}{quoteData.change.toFixed(2)}
                  </span>
                  <span className="text-[10px] font-medium opacity-80 leading-none mt-1">
                     {quoteData.changePercent >= 0 ? '+' : ''}{quoteData.changePercent.toFixed(2)}%
                  </span>
               </div>
            </div>
          )}
        </header>

        {shareBanner && (
          <div className={`px-6 py-2 border-b border-[#333] text-xs ${
            shareStatus === 'error'
              ? 'bg-red-500/10 text-red-400'
              : 'bg-blue-500/10 text-blue-300'
          }`}>
            {shareBanner}
          </div>
        )}

        {/* Comparison Legend Bar */}
        {comparisonData.length > 0 && (
          <div className="px-6 py-2 bg-[#171717] border-b border-[#333] flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
             <span className="text-muted-foreground">Comparing with:</span>
             {comparisonData.map(c => (
               <div key={c.symbol} className="flex items-center gap-2 px-2 py-1 bg-[#1a1a1a] border border-[#333] rounded-lg">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                  <span style={{ color: c.color }}>{c.symbol}</span>
                  <button onClick={() => removeComparison(c.symbol)} className="text-muted-foreground hover:text-white transition-colors">
                     <X size={10} />
                  </button>
               </div>
             ))}
             <div className="flex-1" />
             <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={compareInput}
                  onChange={e => setCompareInput(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && addComparison()}
                  placeholder="ADD TICKER..."
                  className="bg-transparent border-b border-[#444] text-[10px] w-20 outline-none focus:border-white transition-colors p-0.5"
                />
             </div>
          </div>
        )}

        {/* Main Split Layout */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Top area: Chart */}
          <div className="h-[45%] border-b border-[#333] relative bg-black/20">
             {!chartLoading && !chartError && chartData.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-4">
                   <div className="w-16 h-16 rounded-full bg-[#171717] border border-[#333] flex items-center justify-center">
                      <TrendingUp size={32} className="opacity-20" />
                   </div>
                   <p className="text-sm font-medium">Select a ticker to visualize market data</p>
                </div>
             )}
             {chartLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]/50 backdrop-blur-[2px] z-20">
                   <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span className="text-xs font-bold uppercase tracking-[0.2em] animate-pulse">Fetching Market Data...</span>
                   </div>
                </div>
             )}
             {chartError && (
                <div className="absolute inset-0 flex items-center justify-center p-8">
                   <div className="max-w-md bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-4">
                      <AlertCircle size={24} />
                      <div>
                         <p className="text-sm font-bold">Failed to load chart</p>
                         <p className="text-xs opacity-80">{chartError}</p>
                      </div>
                   </div>
                </div>
             )}
             {chartData.length > 0 && !chartLoading && (
               <StockChart
                 data={chartData}
                 period={period}
                 indicators={comparisonData.length === 0 ? indicators : undefined}
                 comparisonData={comparisonData.length > 0 ? comparisonData : undefined}
               />
             )}
          </div>

          {/* Bottom area: Mixed Tabs (Chat, Financials, News) */}
          <div className="flex-1 flex flex-col min-h-0">
             <div className="h-12 border-b border-[#333] flex items-center px-6 gap-6 shrink-0 overflow-x-auto no-scrollbar">
                {[
                  { key: 'chat' as const, label: 'AI Analyst', icon: <MessageSquare size={14} /> },
                  { key: 'financials' as const, label: 'Fundamentals', icon: <BarChart4 size={14} /> },
                  { key: 'news' as const, label: 'Market News', icon: <Newspaper size={14} /> },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setBottomTab(tab.key)}
                    className={`relative h-full flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-all ${
                      bottomTab === tab.key ? 'text-white' : 'text-muted-foreground hover:text-white/60'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                    {bottomTab === tab.key && (
                      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full" />
                    )}
                  </button>
                ))}
                
                <div className="flex-1" />
                
                {bottomTab === 'chat' && (
                  <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-2 duration-300">
                     <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Analysis Engine:</span>
                     <select
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        className="bg-[#171717] border border-[#333] rounded-lg px-2 py-1 text-[10px] font-bold text-blue-400 uppercase tracking-wider focus:ring-1 focus:ring-blue-500/50 outline-none cursor-pointer"
                      >
                        {AVAILABLE_MODELS.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                  </div>
                )}
             </div>

             <div className="flex-1 flex min-h-0 bg-black/10">
                {/* Content Side */}
                <div className="flex-1 min-w-0 border-r border-[#333] flex flex-col">
                   {bottomTab === 'chat' && (
                     <div className="flex-1 flex flex-col min-h-0">
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                           {messages.length === 0 && (
                             <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-8 opacity-40">
                                <div className="grid grid-cols-2 gap-4">
                                   {[
                                      "Analyze current trend",
                                      "Key risk factors?",
                                      "Earnings growth potential",
                                      "Compare with competitors"
                                   ].map((hint, idx) => (
                                      <div key={idx} className="p-4 border border-[#333] rounded-xl text-xs text-center">
                                         {hint}
                                      </div>
                                   ))}
                                </div>
                                <p className="text-xs uppercase font-bold tracking-[0.2em]">Ready for Analysis</p>
                             </div>
                           )}
                           {messages.map((msg) => (
                              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                 <div className={`flex flex-col gap-2 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                    <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                                       msg.role === 'user' 
                                         ? 'bg-[#212121] border border-[#333] text-white rounded-tr-none' 
                                         : 'bg-transparent text-foreground rounded-tl-none font-medium'
                                    }`}>
                                       {renderMessageContent(msg.content)}
                                    </div>
                                    <span className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest px-1">
                                       {msg.role === 'user' ? 'Strategy' : model}
                                    </span>
                                 </div>
                              </div>
                           ))}
                           {isResponding && (
                             <div className="flex justify-start">
                                <div className="flex flex-col gap-2 items-start">
                                   <div className="px-4 py-3 bg-transparent text-blue-400 rounded-2xl rounded-tl-none flex items-center gap-3">
                                      <div className="flex gap-1">
                                         <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                         <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                         <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
                                      </div>
                                      <span className="text-xs font-bold uppercase tracking-widest opacity-50">Synthesizing...</span>
                                   </div>
                                </div>
                             </div>
                           )}
                           <div ref={messagesEndRef} />
                        </div>
                        
                        <div className="p-6 pt-0">
                           <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl p-2 focus-within:ring-1 focus-within:ring-white/20 transition-all">
                              <form 
                                className="flex items-center gap-2"
                                onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                              >
                                 <input
                                   ref={chatInputRef}
                                   type="text"
                                   value={chatInput}
                                   onChange={(e) => setChatInput(e.target.value)}
                                   placeholder={`Run analysis on ${activeTicker || 'markets'}...`}
                                   disabled={isResponding}
                                   className="flex-1 bg-transparent border-none outline-none px-4 py-2 text-sm font-medium placeholder:text-muted-foreground/40"
                                 />
                                 <button
                                   type="submit"
                                   disabled={isResponding || !chatInput.trim()}
                                   className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center hover:bg-neutral-200 transition-all disabled:opacity-20 shadow-lg"
                                 >
                                    <Send size={18} />
                                 </button>
                              </form>
                           </div>
                        </div>
                     </div>
                   )}

                   {bottomTab === 'financials' && (
                     <div className="flex-1 overflow-auto custom-scrollbar">
                        <FinancialStatements ticker={activeTicker} />
                     </div>
                   )}

                   {bottomTab === 'news' && (
                     <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        {news.length > 0 ? (
                           <div className="space-y-4">
                              {news.map((item, i) => (
                                <a
                                  key={i}
                                  href={item.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="group block p-4 bg-[#171717] border border-[#333] rounded-2xl hover:bg-[#1a1a1a] transition-all hover:border-[#444]"
                                >
                                  <div className="flex justify-between items-start mb-2">
                                     <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{item.publisher}</span>
                                     <span className="text-[10px] font-medium text-muted-foreground">{timeAgo(item.publishTime)}</span>
                                  </div>
                                  <h3 className="text-sm font-semibold group-hover:text-blue-400 transition-colors leading-snug">{item.title}</h3>
                                </a>
                              ))}
                           </div>
                        ) : (
                           <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4 opacity-30">
                              <Newspaper size={48} />
                              <p className="text-xs font-bold uppercase tracking-widest">No recent alerts</p>
                           </div>
                        )}
                     </div>
                   )}
                </div>

                {/* Right Tab Sidebar */}
                <div className="w-[300px] shrink-0 flex flex-col bg-black/5">
                   <div className="p-4 border-b border-[#333]">
                      <div className="flex p-1 bg-[#171717] rounded-xl border border-[#333]">
                         {[
                           { key: 'metrics' as const, label: 'Stats' },
                           { key: 'earnings' as const, label: 'Earnings' },
                           { key: 'analyst' as const, label: 'Ratings' },
                         ].map(tab => (
                            <button
                               key={tab.key}
                               onClick={() => setRightTab(tab.key)}
                               className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                                  rightTab === tab.key ? 'bg-[#2f2f2f] text-white' : 'text-muted-foreground hover:text-white/60'
                               }`}
                            >
                               {tab.label}
                            </button>
                         ))}
                      </div>
                   </div>

                   <div className="flex-1 overflow-y-auto custom-scrollbar">
                      {rightTab === 'metrics' && (
                         <div className="p-6 space-y-6">
                            {metrics ? (
                               <>
                                  <div className="space-y-4">
                                     <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4">Core Valuation</h4>
                                     <MetricItem label="Mkt Cap" value={formatLargeNumber(metrics.marketCap)} icon={<Briefcase size={12}/>} />
                                     <MetricItem label="P/E Ratio" value={metrics.peRatio?.toFixed(2) || 'N/A'} icon={<BarChart3 size={12}/>} />
                                     <MetricItem label="Fwd P/E" value={metrics.forwardPE?.toFixed(2) || 'N/A'} icon={<Clock size={12}/>} />
                                     <MetricItem label="Dividend" value={metrics.dividendYield != null ? `${(metrics.dividendYield * 100).toFixed(2)}%` : 'None'} icon={<DollarSign size={12}/>} />
                                  </div>
                                  
                                  <div className="h-[1px] bg-[#333]" />
                                  
                                  <div className="space-y-4">
                                     <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4">Market Ranges</h4>
                                     <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground/50">
                                           <span>52W Low</span>
                                           <span>52W High</span>
                                        </div>
                                        <div className="h-1.5 bg-[#171717] rounded-full relative overflow-hidden flex items-center border border-[#333]">
                                           {metrics.fiftyTwoWeekLow && metrics.fiftyTwoWeekHigh && quoteData && (
                                              <div 
                                                className="absolute h-full bg-blue-500/50"
                                                style={{
                                                   left: '20%', // simplified for logic
                                                   width: '60%'
                                                }}
                                              />
                                           )}
                                        </div>
                                        <div className="flex justify-between text-xs font-bold">
                                           <span>${metrics.fiftyTwoWeekLow?.toFixed(2)}</span>
                                           <span>${metrics.fiftyTwoWeekHigh?.toFixed(2)}</span>
                                        </div>
                                     </div>
                                  </div>
                                  
                                  <div className="space-y-4 pt-2">
                                     <MetricItem label="Avg Volume" value={formatVolume(metrics.avgVolume)} />
                                     <MetricItem label="Beta" value={metrics.beta?.toFixed(2) || 'N/A'} />
                                  </div>

                                  <div className="mt-8 p-6 bg-blue-500/5 border border-blue-500/20 rounded-2xl flex flex-col items-center gap-2">
                                     <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Analyst Verdict</span>
                                     <span className="text-xl font-bold uppercase tracking-tighter">{metrics.analystRating || 'Neutral'}</span>
                                     <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                                        Target: <span className="text-white">${metrics.targetPrice?.toFixed(2)}</span>
                                     </div>
                                  </div>
                               </>
                            ) : (
                               <div className="h-64 flex flex-col items-center justify-center opacity-20 gap-4">
                                  <BarChart3 size={48} />
                                  <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Data Pending</p>
                               </div>
                            )}
                         </div>
                      )}

                      {rightTab === 'earnings' && <div className="p-4"><EarningsPanel ticker={activeTicker} /></div>}
                      {rightTab === 'analyst' && <div className="p-4"><AnalystPanel ticker={activeTicker} /></div>}
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FinancePage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-foreground">Loading finance workspace...</div>}>
      <FinancePageContent />
    </Suspense>
  );
}

function MetricItem({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
   return (
      <div className="flex items-center justify-between group">
         <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground transition-colors">
            {icon && <span className="opacity-40">{icon}</span>}
            <span className="text-xs font-semibold">{label}</span>
         </div>
         <span className="text-sm font-bold tracking-tight">{value}</span>
      </div>
   );
}
