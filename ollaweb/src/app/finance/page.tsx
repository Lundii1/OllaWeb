"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { StockChart } from '../components/stock-chart';
import { Watchlist } from '../components/watchlist';
import { FinancialStatements } from '../components/financial-statements';
import { EarningsPanel } from '../components/earnings-panel';
import { AnalystPanel } from '../components/analyst-panel';
import { CodeBlock } from '../components/code-block';
import { AVAILABLE_MODELS, COMPARISON_COLORS } from '../../lib/types';
import type { ChartDataPoint, QuoteData, ChartPeriod, NewsItem, KeyMetrics, IndicatorConfig, ComparisonTicker } from '../../lib/types';

const PERIODS: ChartPeriod[] = ['1d', '5d', '1mo', '3mo', '1y', '5y'];
const PERIOD_LABELS: Record<ChartPeriod, string> = {
  '1d': '1D', '5d': '5D', '1mo': '1M', '3mo': '3M', '1y': '1Y', '5y': '5Y',
};

type BottomTab = 'chat' | 'financials' | 'news';
type RightTab = 'metrics' | 'earnings' | 'analyst';

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

export default function FinancePage() {
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
  const [model, setModel] = useState('llama3.2');
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

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

  const handleLoadTicker = useCallback(() => {
    if (!ticker.trim()) return;
    setMessages([]);
    setComparisonData([]);
    earningsDataRef.current = null;
    analystDataRef.current = null;
    financialsDataRef.current = null;
    fetchQuote(ticker.trim(), period);
  }, [ticker, period, fetchQuote]);

  // Load ticker from watchlist
  const handleWatchlistSelect = useCallback((symbol: string) => {
    setTicker(symbol);
    setMessages([]);
    setComparisonData([]);
    earningsDataRef.current = null;
    analystDataRef.current = null;
    financialsDataRef.current = null;
    fetchQuote(symbol, period);
  }, [period, fetchQuote]);

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
  }, [chatInput, isResponding, messages, model, activeTicker]);

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
          <div key={index} className="bg-retro-surface retro-sunken p-2 italic text-retro-amber">
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
      <span className="text-retro-amber text-xs">{label}</span>
      <span className="text-retro-text-bright text-xs font-mono">{value}</span>
    </div>
  );

  // Indicator toggle button helper
  const IndicatorBtn = ({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className={`px-1.5 py-0.5 text-[10px] ${
        active
          ? 'retro-sunken bg-retro-panel'
          : 'retro-raised bg-retro-surface text-retro-text hover:text-retro-text-bright'
      }`}
      style={active ? { color } : undefined}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col h-screen bg-retro-bg text-retro-text">
      {/* Header */}
      <header className="sticky top-0 bg-retro-surface retro-raised z-10 shrink-0">
        <div className="retro-titlebar flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-retro-green text-lg tracking-wider">[OllaWeb v2.0]</h1>
            <nav className="flex gap-1">
              <Link
                href="/"
                className="retro-raised bg-retro-surface px-2 py-0.5 text-retro-text text-sm no-underline hover:bg-retro-panel hover:text-retro-text-bright"
              >
                Chat
              </Link>
              <Link
                href="/resume"
                className="retro-raised bg-retro-surface px-2 py-0.5 text-retro-text text-sm no-underline hover:bg-retro-panel hover:text-retro-text-bright"
              >
                Resume
              </Link>
              <span className="retro-sunken bg-retro-panel px-2 py-0.5 text-retro-green text-sm">
                Finance
              </span>
            </nav>
          </div>
          <div className="flex gap-2 text-retro-text text-sm">
            <span className="retro-raised bg-retro-surface px-1 cursor-default">_</span>
            <span className="retro-raised bg-retro-surface px-1 cursor-default">[]</span>
            <span className="retro-raised bg-retro-surface px-1 cursor-default">X</span>
          </div>
        </div>
      </header>

      {/* Ticker toolbar */}
      <div className="bg-retro-surface retro-raised px-4 py-2 flex items-center gap-3 shrink-0 flex-wrap">
        <span className="text-retro-amber text-sm">Ticker:</span>
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && handleLoadTicker()}
          placeholder="AAPL"
          className="retro-sunken bg-retro-bg text-retro-green px-2 py-0.5 text-sm w-28 outline-none uppercase"
        />
        <button
          type="button"
          onClick={handleLoadTicker}
          disabled={!ticker.trim() || chartLoading}
          className="retro-raised bg-retro-panel text-retro-cyan px-2 py-0.5 text-sm hover:bg-retro-blue hover:text-retro-text-bright disabled:opacity-40"
        >
          {chartLoading ? '[LOADING...]' : '[LOAD]'}
        </button>

        <div className="flex gap-1 ml-3">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handlePeriodChange(p)}
              disabled={!activeTicker}
              className={`px-2 py-0.5 text-xs ${
                period === p
                  ? 'retro-sunken bg-retro-panel text-retro-green'
                  : 'retro-raised bg-retro-surface text-retro-text hover:bg-retro-panel hover:text-retro-text-bright'
              } disabled:opacity-40`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Indicators toolbar */}
        {activeTicker && comparisonData.length === 0 && (
          <div className="flex gap-1 ml-2 items-center">
            <span className="text-retro-border-light text-[10px] mr-1">IND:</span>
            <IndicatorBtn label="SMA" active={indicators.sma} color="#00d4ff" onClick={() => toggleIndicator('sma')} />
            <IndicatorBtn label="EMA" active={indicators.ema} color="#ffb000" onClick={() => toggleIndicator('ema')} />
            <IndicatorBtn label="BB" active={indicators.bollinger} color="#4488ff" onClick={() => toggleIndicator('bollinger')} />
            <IndicatorBtn label="RSI" active={indicators.rsi} color="#a855f7" onClick={() => toggleIndicator('rsi')} />
            <IndicatorBtn label="MACD" active={indicators.macd} color="#00d4ff" onClick={() => toggleIndicator('macd')} />
          </div>
        )}

        {/* Comparison input */}
        {activeTicker && (
          <div className="flex gap-1 ml-2 items-center">
            <span className="text-retro-border-light text-[10px] mr-1">CMP:</span>
            <input
              type="text"
              value={compareInput}
              onChange={e => setCompareInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && addComparison()}
              placeholder="ADD..."
              className="retro-sunken bg-retro-bg text-retro-green px-1.5 py-0.5 text-xs w-16 outline-none uppercase"
            />
            <button
              type="button"
              onClick={addComparison}
              disabled={!compareInput.trim() || comparisonData.length >= 4}
              className="retro-raised bg-retro-panel text-retro-green px-1 py-0.5 text-xs hover:bg-retro-blue disabled:opacity-40"
            >
              +
            </button>
          </div>
        )}

        {/* Quote info */}
        {quoteData && (
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-retro-text-bright">{quoteData.name}</span>
            <span className="text-retro-text-bright">
              ${quoteData.price.toFixed(2)}
            </span>
            <span className={quoteData.change >= 0 ? 'text-retro-green' : 'text-retro-red'}>
              {quoteData.change >= 0 ? '+' : ''}{quoteData.change.toFixed(2)} ({quoteData.changePercent >= 0 ? '+' : ''}{quoteData.changePercent.toFixed(2)}%)
            </span>
          </div>
        )}
      </div>

      {/* Comparison legend */}
      {comparisonData.length > 0 && (
        <div className="bg-retro-surface px-4 py-1 flex items-center gap-3 text-xs shrink-0 border-t border-retro-border-dark">
          <span className="text-retro-border-light">Comparing:</span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 inline-block" style={{ backgroundColor: '#39ff14' }} />
            <span className="text-retro-green">{activeTicker}</span>
          </span>
          {comparisonData.map(c => (
            <span key={c.symbol} className="flex items-center gap-1">
              <span className="w-3 h-0.5 inline-block" style={{ backgroundColor: c.color }} />
              <span style={{ color: c.color }}>{c.symbol}</span>
              <button
                type="button"
                onClick={() => removeComparison(c.symbol)}
                className="text-retro-border-light hover:text-retro-red"
              >
                x
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Watchlist (left) */}
        <Watchlist
          onSelectTicker={handleWatchlistSelect}
          activeTicker={activeTicker}
          collapsed={watchlistCollapsed}
          onToggleCollapse={() => setWatchlistCollapsed(prev => !prev)}
        />

        {/* Center column: Chart + Bottom tabs */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Chart area */}
          <div className="shrink-0 retro-sunken bg-retro-bg relative" style={{ height: '45%' }}>
            {chartLoading && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <span className="text-retro-cyan retro-blink text-lg">Loading chart data...</span>
              </div>
            )}
            {chartError && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <span className="text-retro-red">[ERROR] {chartError}</span>
              </div>
            )}
            {!chartLoading && !chartError && chartData.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-retro-border-light">Enter a ticker symbol and click [LOAD] to view stock data</span>
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

          {/* Bottom section with tabs */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Tab bar */}
            <div className="bg-retro-surface retro-raised px-4 py-1 flex items-center gap-1 shrink-0">
              {([
                { key: 'chat' as const, label: 'CHAT' },
                { key: 'financials' as const, label: 'FINANCIALS' },
                { key: 'news' as const, label: 'NEWS' },
              ]).map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setBottomTab(tab.key)}
                  className={`px-2 py-0.5 text-xs ${
                    bottomTab === tab.key
                      ? 'retro-sunken bg-retro-panel text-retro-green'
                      : 'retro-raised bg-retro-surface text-retro-text hover:text-retro-text-bright'
                  }`}
                >
                  [{tab.label}]
                </button>
              ))}
              {bottomTab === 'chat' && (
                <>
                  <span className="text-retro-text text-xs ml-3">Model:</span>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="retro-sunken bg-retro-bg text-retro-green px-2 py-0.5 text-xs outline-none"
                  >
                    {AVAILABLE_MODELS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  {activeTicker && (
                    <span className="text-retro-cyan text-xs ml-auto">
                      Analyzing: {activeTicker}
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Tab content */}
            {bottomTab === 'chat' && (
              <div className="flex-1 flex flex-col min-h-0">
                <main className="flex-1 overflow-auto p-4 space-y-3">
                  {messages.length === 0 && (
                    <div className="flex items-center justify-center h-full">
                      <span className="text-retro-border-light text-sm">
                        {activeTicker
                          ? `Ask anything about ${activeTicker}...`
                          : 'Load a stock ticker to start chatting'}
                      </span>
                    </div>
                  )}
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`retro-raised max-w-[85%] p-3 text-sm ${
                          msg.role === 'user'
                            ? 'bg-retro-user-bg text-retro-cyan'
                            : 'bg-retro-assistant-bg text-retro-text'
                        }`}
                      >
                        <div className="text-xs text-retro-border-light mb-1">
                          {msg.role === 'user' ? '> You' : `< ${model}`}
                        </div>
                        <div className="whitespace-pre-wrap break-words">
                          {renderMessageContent(msg.content)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {isResponding && messages[messages.length - 1]?.role !== 'assistant' && (
                    <div className="flex justify-start">
                      <div className="retro-raised bg-retro-assistant-bg p-3 text-sm">
                        <span className="text-retro-cyan retro-blink">Searching & analyzing...</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </main>
                <div className="bg-retro-surface retro-raised px-4 py-2 shrink-0">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendMessage();
                    }}
                    className="flex gap-2"
                  >
                    <span className="text-retro-green py-1">&gt;</span>
                    <input
                      ref={chatInputRef}
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder={`Ask about ${activeTicker || 'a stock'}...`}
                      disabled={isResponding}
                      className="flex-1 retro-sunken bg-retro-bg text-retro-green px-3 py-1 text-sm outline-none disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={isResponding || !chatInput.trim()}
                      className="retro-raised bg-retro-panel text-retro-green px-3 py-1 text-sm hover:bg-retro-blue hover:text-retro-text-bright disabled:opacity-40"
                    >
                      {isResponding ? '[...]' : '[SEND]'}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {bottomTab === 'financials' && (
              <div className="flex-1 min-h-0">
                <FinancialStatements ticker={activeTicker} />
              </div>
            )}

            {bottomTab === 'news' && (
              <div className="flex-1 overflow-y-auto">
                {news.length > 0 ? (
                  <div className="px-4 py-3 space-y-2">
                    {news.map((item, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-retro-green shrink-0">&bull;</span>
                        <div className="min-w-0">
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-retro-cyan hover:text-retro-text-bright no-underline hover:underline"
                          >
                            {item.title}
                          </a>
                          <div className="text-retro-border-light text-xs mt-0.5">
                            {item.publisher}{item.publishTime ? ` - ${timeAgo(item.publishTime)}` : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-retro-border-light text-sm">
                      {activeTicker ? 'No news available' : 'Load a ticker to view news'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar with tabs */}
        <div className="w-64 shrink-0 flex flex-col bg-retro-surface retro-raised">
          {/* Right tab bar */}
          <div className="flex shrink-0 border-b border-retro-border-light">
            {([
              { key: 'metrics' as const, label: 'METRICS' },
              { key: 'earnings' as const, label: 'EARNINGS' },
              { key: 'analyst' as const, label: 'ANALYST' },
            ]).map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setRightTab(tab.key)}
                className={`flex-1 px-1 py-1.5 text-[10px] ${
                  rightTab === tab.key
                    ? 'bg-retro-panel text-retro-green border-b-2 border-retro-green'
                    : 'bg-retro-surface text-retro-text hover:text-retro-text-bright'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Right tab content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {rightTab === 'metrics' && (
              <>
                {metrics ? (
                  <div className="px-3 py-2 space-y-0.5">
                    <MetricRow label="Mkt Cap" value={formatLargeNumber(metrics.marketCap)} />
                    <MetricRow label="P/E" value={metrics.peRatio != null ? metrics.peRatio.toFixed(2) : 'N/A'} />
                    <MetricRow label="Fwd P/E" value={metrics.forwardPE != null ? metrics.forwardPE.toFixed(2) : 'N/A'} />
                    <MetricRow label="Beta" value={metrics.beta != null ? metrics.beta.toFixed(2) : 'N/A'} />
                    <MetricRow
                      label="Div Yield"
                      value={metrics.dividendYield != null ? `${(metrics.dividendYield * 100).toFixed(2)}%` : 'N/A'}
                    />
                    <div className="border-t border-retro-border-light my-1" />
                    <MetricRow
                      label="52W High"
                      value={metrics.fiftyTwoWeekHigh != null ? `$${metrics.fiftyTwoWeekHigh.toFixed(2)}` : 'N/A'}
                    />
                    <MetricRow
                      label="52W Low"
                      value={metrics.fiftyTwoWeekLow != null ? `$${metrics.fiftyTwoWeekLow.toFixed(2)}` : 'N/A'}
                    />
                    <MetricRow label="Avg Vol" value={formatVolume(metrics.avgVolume)} />
                    <div className="border-t border-retro-border-light my-1" />
                    <MetricRow
                      label="Target"
                      value={metrics.targetPrice != null ? `$${metrics.targetPrice.toFixed(2)}` : 'N/A'}
                    />
                    <MetricRow
                      label="Rating"
                      value={metrics.analystRating ? metrics.analystRating.charAt(0).toUpperCase() + metrics.analystRating.slice(1) : 'N/A'}
                    />
                  </div>
                ) : (
                  <div className="px-3 py-4 text-center">
                    <span className="text-retro-border-light text-xs">
                      {activeTicker ? 'Loading metrics...' : 'Load a ticker to view metrics'}
                    </span>
                  </div>
                )}
              </>
            )}

            {rightTab === 'earnings' && (
              <EarningsPanel ticker={activeTicker} />
            )}

            {rightTab === 'analyst' && (
              <AnalystPanel ticker={activeTicker} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
