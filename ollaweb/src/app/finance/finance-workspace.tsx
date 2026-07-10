"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  BarChart3,
  BarChart4,
  Check,
  CircleDollarSign,
  Gauge,
  LineChart,
  Loader2,
  Newspaper,
  Send,
  Share2,
  Square,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import { AppFooter, AppHeader, AppMain, AppShell, StatusToast } from "../components/app-shell";
import { AnalystPanel } from "../components/analyst-panel";
import { EarningsPanel } from "../components/earnings-panel";
import { FinancialStatements } from "../components/financial-statements";
import { MarkdownMessage } from "../components/markdown-message";
import { Persona, type PersonaState } from "../components/persona";
import { StockChart } from "../components/stock-chart";
import { Watchlist } from "../components/watchlist";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "../../components/ai/reasoning";
import { splitChatContent } from "../../lib/chat-content";
import {
  calculateRangePosition,
  formatCurrency,
  parseFinanceShareParams,
  validateComparisonSymbol,
} from "../../lib/finance-utils";
import { trackGrowthMetric } from "../../lib/growth-metrics";
import {
  AVAILABLE_MODELS,
  COMPARISON_COLORS,
  type ChartPeriod,
  type ComparisonTicker,
  type IndicatorConfig,
  type KeyMetrics,
  type Message,
  type NewsItem,
  type QuoteData,
  type StatementPeriodType,
  type StatementType,
} from "../../lib/types";
import { useFinanceData, type QuoteLoadResult } from "./use-finance-data";

const PERIODS: ChartPeriod[] = ["1d", "5d", "1mo", "3mo", "1y", "5y"];
const PERIOD_LABELS: Record<ChartPeriod, string> = {
  "1d": "1D",
  "5d": "5D",
  "1mo": "1M",
  "3mo": "3M",
  "1y": "1Y",
  "5y": "5Y",
};

const DEFAULT_INDICATORS: IndicatorConfig = {
  sma: false,
  ema: false,
  rsi: false,
  macd: false,
  bollinger: false,
};

const INDICATOR_LABELS: { key: keyof IndicatorConfig; label: string }[] = [
  { key: "sma", label: "SMA" },
  { key: "ema", label: "EMA" },
  { key: "bollinger", label: "Bollinger" },
  { key: "rsi", label: "RSI" },
  { key: "macd", label: "MACD" },
];

type ResearchTab = "overview" | "financials" | "earnings" | "ratings" | "news";
type BannerState = { text: string; tone: "default" | "error" } | null;

const RESEARCH_TABS: { key: ResearchTab; label: string; icon: ReactNode }[] = [
  { key: "overview", label: "Overview", icon: <Gauge className="size-4" aria-hidden="true" /> },
  { key: "financials", label: "Fundamentals", icon: <BarChart4 className="size-4" aria-hidden="true" /> },
  { key: "earnings", label: "Earnings", icon: <CircleDollarSign className="size-4" aria-hidden="true" /> },
  { key: "ratings", label: "Ratings", icon: <Target className="size-4" aria-hidden="true" /> },
  { key: "news", label: "News", icon: <Newspaper className="size-4" aria-hidden="true" /> },
];

const SUGGESTED_PROMPTS = [
  "Analyze the current trend",
  "What are the key risk factors?",
  "Summarize earnings growth potential",
  "Compare this company with its peers",
];

function formatLargeNumber(value: number | null | undefined): string {
  if (!Number.isFinite(value)) return "N/A";
  const absolute = Math.abs(value as number);
  if (absolute >= 1e12) return `${((value as number) / 1e12).toFixed(2)}T`;
  if (absolute >= 1e9) return `${((value as number) / 1e9).toFixed(2)}B`;
  if (absolute >= 1e6) return `${((value as number) / 1e6).toFixed(2)}M`;
  return new Intl.NumberFormat().format(value as number);
}

function timeAgo(unixSeconds: number): string {
  if (!unixSeconds) return "Recently";
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function makeMessageId(suffix = "") {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}${suffix}`;
}

export function FinanceWorkspace() {
  const searchParams = useSearchParams();
  const finance = useFinanceData();
  const {
    activeTicker,
    period,
    quoteData,
    chartData,
    news,
    metrics,
    chartLoading,
    chartError,
    earnings,
    analyst,
    financialContext,
    loadTicker,
    fetchFinancials,
    getFinancialResource,
    clearChartError,
  } = finance;

  const [ticker, setTicker] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [model, setModel] = useState<string>(AVAILABLE_MODELS[0]?.value ?? "");
  const [researchTab, setResearchTab] = useState<ResearchTab | null>(null);
  const [pendingPeriod, setPendingPeriod] = useState<ChartPeriod | null>(null);
  const [statementType, setStatementType] = useState<StatementType>("income");
  const [statementPeriod, setStatementPeriod] = useState<StatementPeriodType>("annual");
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isResponding, setIsResponding] = useState(false);
  const [indicators, setIndicators] = useState<IndicatorConfig>(DEFAULT_INDICATORS);
  const [compareInput, setCompareInput] = useState("");
  const [comparisonData, setComparisonData] = useState<ComparisonTicker[]>([]);
  const [comparisonPeriod, setComparisonPeriod] = useState<ChartPeriod | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "error">("idle");
  const [banner, setBanner] = useState<BannerState>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const sharedLinkAppliedRef = useRef(false);
  const chatAbortRef = useRef<AbortController | null>(null);
  const comparisonAbortRef = useRef<AbortController | null>(null);
  const comparisonSequenceRef = useRef(0);
  const periodSequenceRef = useRef(0);
  const comparisonDataRef = useRef<ComparisonTicker[]>([]);

  const financialResource = getFinancialResource(statementType, statementPeriod);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, isResponding]);

  useEffect(() => {
    comparisonDataRef.current = comparisonData;
  }, [comparisonData]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      setSidebarOpen(false);
    }
  }, []);

  useEffect(() => {
    if (!banner) return;
    const timer = window.setTimeout(() => setBanner(null), 4500);
    return () => window.clearTimeout(timer);
  }, [banner]);

  useEffect(() => {
    if (shareStatus === "idle") return;
    const timer = window.setTimeout(() => setShareStatus("idle"), 2500);
    return () => window.clearTimeout(timer);
  }, [shareStatus]);

  useEffect(() => {
    return () => {
      chatAbortRef.current?.abort();
      comparisonAbortRef.current?.abort();
    };
  }, []);

  const resetTickerScopedState = useCallback(() => {
    chatAbortRef.current?.abort();
    comparisonAbortRef.current?.abort();
    comparisonSequenceRef.current += 1;
    setMessages([]);
    setIsResponding(false);
    setComparisonData([]);
    comparisonDataRef.current = [];
    setComparisonPeriod(null);
    setCompareInput("");
    setComparisonError(null);
    setIndicators(DEFAULT_INDICATORS);
    setResearchTab(null);
  }, []);

  const applyTickerResult = useCallback(
    (result: QuoteLoadResult) => {
      if (!result.ok || !result.symbol) return;
      setTicker(result.symbol);
      if (result.changed) resetTickerScopedState();
    },
    [resetTickerScopedState],
  );

  const handleLoadTicker = useCallback(async () => {
    const result = await loadTicker(ticker, period);
    applyTickerResult(result);
  }, [applyTickerResult, loadTicker, period, ticker]);

  const handleWatchlistSelect = useCallback(
    async (symbol: string) => {
      setTicker(symbol);
      const result = await loadTicker(symbol, period);
      applyTickerResult(result);
    },
    [applyTickerResult, loadTicker, period],
  );

  useEffect(() => {
    if (sharedLinkAppliedRef.current || !searchParams) return;
    const shared = parseFinanceShareParams(searchParams);
    if (!shared) return;
    sharedLinkAppliedRef.current = true;
    setTicker(shared.ticker);

    void loadTicker(shared.ticker, shared.period).then((result) => {
      if (!result.ok) return;
      applyTickerResult(result);
      if (shared.prompt) setChatInput(shared.prompt);
      setBanner({
        text: shared.prompt
          ? `Loaded ${shared.ticker} with a ready-to-run prompt.`
          : `Loaded the shared ${shared.ticker} workspace.`,
        tone: "default",
      });
      trackGrowthMetric("share_link_opened", {
        ticker: shared.ticker,
        period: shared.period,
        hasPrompt: Boolean(shared.prompt),
      });
    });
  }, [applyTickerResult, loadTicker, searchParams]);

  useEffect(() => {
    if (researchTab !== "financials" || !activeTicker) return;
    void fetchFinancials(activeTicker, statementType, statementPeriod);
  }, [activeTicker, fetchFinancials, researchTab, statementPeriod, statementType]);

  const refreshComparisons = useCallback(
    async (nextPeriod: ChartPeriod, current: ComparisonTicker[]) => {
      if (!activeTicker || current.length === 0) return;
      comparisonAbortRef.current?.abort();
      const controller = new AbortController();
      comparisonAbortRef.current = controller;
      const sequence = ++comparisonSequenceRef.current;
      setComparisonLoading(true);
      setComparisonError(null);

      try {
        const refreshed = await Promise.all(
          current.map(async (comparison) => {
            const response = await fetch(
              `/api/finance/quote?ticker=${encodeURIComponent(comparison.symbol)}&period=${nextPeriod}`,
              { signal: controller.signal },
            );
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || `Unable to refresh ${comparison.symbol}`);
            return {
              symbol: payload.symbol || comparison.symbol,
              data: payload.chartData,
              color: comparison.color,
              changePercent: payload.changePercent || 0,
            } satisfies ComparisonTicker;
          }),
        );
        if (sequence === comparisonSequenceRef.current) {
          comparisonDataRef.current = refreshed;
          setComparisonData(refreshed);
          setComparisonPeriod(nextPeriod);
        }
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (sequence === comparisonSequenceRef.current) {
          setComparisonError(
            error instanceof Error ? error.message : "Unable to refresh comparisons",
          );
        }
      } finally {
        if (sequence === comparisonSequenceRef.current) setComparisonLoading(false);
      }
    },
    [activeTicker],
  );

  const handlePeriodChange = useCallback(
    async (nextPeriod: ChartPeriod) => {
      if (!activeTicker || (nextPeriod === period && pendingPeriod === null)) return;
      const requestSequence = ++periodSequenceRef.current;
      setPendingPeriod(nextPeriod);
      if (comparisonDataRef.current.length > 0) setComparisonLoading(true);
      const result = await loadTicker(activeTicker, nextPeriod, false);
      if (requestSequence !== periodSequenceRef.current) return;
      setPendingPeriod(null);
      if (!result.ok) {
        setComparisonLoading(false);
        return;
      }
      const currentComparisons = comparisonDataRef.current;
      if (currentComparisons.length > 0) {
        void refreshComparisons(nextPeriod, currentComparisons);
      } else {
        setComparisonLoading(false);
      }
    },
    [activeTicker, loadTicker, pendingPeriod, period, refreshComparisons],
  );

  const addComparison = useCallback(
    async (event?: FormEvent) => {
      event?.preventDefault();
      if (pendingPeriod || chartLoading) return;
      const currentPeriodComparisons = comparisonPeriod === period ? comparisonData : [];
      const validation = validateComparisonSymbol(
        compareInput,
        activeTicker,
        currentPeriodComparisons.map((item) => item.symbol),
      );
      if (validation.error) {
        setComparisonError(validation.error);
        return;
      }

      comparisonAbortRef.current?.abort();
      const controller = new AbortController();
      comparisonAbortRef.current = controller;
      const sequence = ++comparisonSequenceRef.current;
      setComparisonLoading(true);
      setComparisonError(null);

      try {
        const response = await fetch(
          `/api/finance/quote?ticker=${encodeURIComponent(validation.symbol)}&period=${period}`,
          { signal: controller.signal },
        );
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || `Unable to load ${validation.symbol}`);
        if (sequence !== comparisonSequenceRef.current) return;

        setComparisonData((current) => {
          const compatibleCurrent = comparisonPeriod === period ? current : [];
          const next = [
            ...compatibleCurrent,
            {
            symbol: payload.symbol || validation.symbol,
            data: payload.chartData,
            color: COMPARISON_COLORS[compatibleCurrent.length % COMPARISON_COLORS.length],
            changePercent: payload.changePercent || 0,
            },
          ];
          comparisonDataRef.current = next;
          return next;
        });
        setComparisonPeriod(period);
        setCompareInput("");
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (sequence === comparisonSequenceRef.current) {
          setComparisonError(error instanceof Error ? error.message : "Unable to add comparison");
        }
      } finally {
        if (sequence === comparisonSequenceRef.current) setComparisonLoading(false);
      }
    },
    [activeTicker, chartLoading, compareInput, comparisonData, comparisonPeriod, pendingPeriod, period],
  );

  const removeComparison = useCallback((symbol: string) => {
    comparisonAbortRef.current?.abort();
    comparisonSequenceRef.current += 1;
    setComparisonLoading(false);
    const next = comparisonDataRef.current.filter((item) => item.symbol !== symbol);
    comparisonDataRef.current = next;
    setComparisonData(next);
    if (next.length === 0) setComparisonPeriod(null);
    setComparisonError(null);
  }, []);

  const toggleIndicator = useCallback(
    (indicator: keyof IndicatorConfig) => {
      if (comparisonData.length > 0) return;
      setIndicators((current) => ({ ...current, [indicator]: !current[indicator] }));
    },
    [comparisonData.length],
  );

  const handleShareSetup = useCallback(async () => {
    if (!activeTicker || typeof window === "undefined") return;
    const latestPrompt = [...messages]
      .reverse()
      .find((message) => message.role === "user")
      ?.content.trim();
    const prompt = (latestPrompt || chatInput.trim()).slice(0, 500);
    const shareUrl = new URL("/finance", window.location.origin);
    shareUrl.searchParams.set("sym", activeTicker);
    shareUrl.searchParams.set("p", period);
    if (prompt) shareUrl.searchParams.set("q", prompt);

    try {
      await navigator.clipboard.writeText(shareUrl.toString());
      setShareStatus("copied");
      setBanner({ text: "Share link copied to the clipboard.", tone: "default" });
      trackGrowthMetric("share_link_created", {
        ticker: activeTicker,
        period,
        hasPrompt: Boolean(prompt),
      });
    } catch {
      setShareStatus("error");
      setBanner({ text: "Clipboard access was denied. Try sharing again.", tone: "error" });
    }
  }, [activeTicker, chatInput, messages, period]);

  const stopResponse = useCallback(() => {
    chatAbortRef.current?.abort();
  }, []);

  const handleSendMessage = useCallback(
    async (event?: FormEvent) => {
      event?.preventDefault();
      const prompt = chatInput.trim();
      if (!prompt || !activeTicker || isResponding) return;

      const userMessage: Message = {
        id: makeMessageId("-user"),
        role: "user",
        content: prompt,
      };
      const assistantId = makeMessageId("-assistant");
      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      setChatInput("");
      setIsResponding(true);

      const controller = new AbortController();
      chatAbortRef.current?.abort();
      chatAbortRef.current = controller;

      try {
        const financialData: Record<string, unknown> = {};
        if (quoteData) financialData.quote = quoteData;
        if (metrics) financialData.metrics = metrics;
        if (news.length > 0) financialData.news = news;
        if (earnings.data) financialData.earnings = earnings.data;
        if (analyst.data) financialData.analyst = analyst.data;
        if (financialContext) financialData.financials = financialContext;

        const formData = new FormData();
        formData.append("messages", JSON.stringify(nextMessages));
        formData.append("model", model);
        formData.append("ticker", activeTicker);
        formData.append("financialData", JSON.stringify(financialData));

        const response = await fetch("/api/finance/chat", {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({ error: "Request failed" }));
          throw new Error(body.error || "Request failed");
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("The analysis stream was unavailable");
        const decoder = new TextDecoder();
        let content = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          content += decoder.decode(value, { stream: true });
          setMessages((current) => {
            const existingIndex = current.findIndex((message) => message.id === assistantId);
            if (existingIndex === -1) {
              return [...current, { id: assistantId, role: "assistant", content }];
            }
            const updated = [...current];
            updated[existingIndex] = { ...updated[existingIndex], content };
            return updated;
          });
        }
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        const content = `Error: ${error instanceof Error ? error.message : "Unable to complete analysis"}`;
        setMessages((current) => [
          ...current.filter((message) => message.id !== assistantId),
          { id: assistantId, role: "assistant", content },
        ]);
      } finally {
        if (chatAbortRef.current === controller) {
          chatAbortRef.current = null;
          setIsResponding(false);
        }
      }
    },
    [
      activeTicker,
      analyst.data,
      chatInput,
      earnings.data,
      financialContext,
      isResponding,
      messages,
      metrics,
      model,
      news,
      quoteData,
    ],
  );

  const personaState: PersonaState = isResponding ? "thinking" : "idle";

  return (
    <AppShell>
      <Watchlist
        onSelectTicker={handleWatchlistSelect}
        activeTicker={activeTicker}
        collapsed={!sidebarOpen}
        onToggleCollapse={() => setSidebarOpen((open) => !open)}
        ticker={ticker}
        onTickerChange={setTicker}
        onLoadTicker={handleLoadTicker}
        tickerLoading={chartLoading}
      />

      <AppMain>
        <AppHeader
          actions={
            <div className="flex min-w-0 items-center gap-2">
              <label htmlFor="finance-model" className="sr-only">
                Analysis model
              </label>
              <select
                id="finance-model"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className="max-w-56 truncate rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-foreground outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/30"
              >
                {AVAILABLE_MODELS.map((availableModel) => (
                  <option key={availableModel.value} value={availableModel.value} className="bg-neutral-900">
                    {availableModel.label}
                  </option>
                ))}
              </select>
            </div>
          }
        />

        <main className="flex-1 overflow-y-auto p-4">
          {!activeTicker ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <Persona state={personaState} variant="halo" className="size-24" />
              <div>
                <p className="text-sm font-medium text-foreground">Start a market conversation</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Search for a ticker or choose one from your watchlist.
                </p>
              </div>
              {chartLoading && (
                <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Loading {ticker.trim().toUpperCase() || "ticker"} market data…
                </div>
              )}
              {chartError && (
                <div role="alert" className="flex max-w-md items-start gap-3 rounded-lg border border-red-400/20 bg-red-500/10 p-3 text-left text-sm text-red-300">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">Ticker could not be loaded</p>
                    <p className="mt-1 text-red-200/80">{chartError}</p>
                  </div>
                  <button type="button" onClick={clearChartError} aria-label="Dismiss error" className="rounded p-1 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30">
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 pb-4">
              <MarketSnapshot
                quote={quoteData}
                period={period}
                pendingPeriod={pendingPeriod}
                chartData={chartData}
                chartLoading={chartLoading}
                chartError={chartError}
                indicators={indicators}
                comparisons={comparisonData}
                comparisonPeriod={comparisonPeriod}
                comparisonInput={compareInput}
                comparisonLoading={comparisonLoading}
                comparisonError={comparisonError}
                shareStatus={shareStatus}
                onPeriodChange={handlePeriodChange}
                onToggleIndicator={toggleIndicator}
                onComparisonInputChange={setCompareInput}
                onAddComparison={addComparison}
                onRemoveComparison={removeComparison}
                onShare={handleShareSetup}
                onDismissError={clearChartError}
              />

              <ResearchWorkspace
                activeTab={researchTab}
                onTabChange={(tab) => setResearchTab((current) => (current === tab ? null : tab))}
                quote={quoteData}
                metrics={metrics}
                news={news}
              >
                {researchTab === "financials" && (
                  <FinancialStatements
                    ticker={activeTicker}
                    data={financialResource.data}
                    loading={financialResource.loading}
                    error={financialResource.error}
                    statementType={statementType}
                    periodType={statementPeriod}
                    onStatementTypeChange={setStatementType}
                    onPeriodTypeChange={setStatementPeriod}
                  />
                )}
                {researchTab === "earnings" && (
                  <EarningsPanel
                    ticker={activeTicker}
                    data={earnings.data}
                    loading={earnings.loading}
                    error={earnings.error}
                  />
                )}
                {researchTab === "ratings" && (
                  <AnalystPanel
                    ticker={activeTicker}
                    data={analyst.data}
                    loading={analyst.loading}
                    error={analyst.error}
                    currency={quoteData?.currency}
                  />
                )}
              </ResearchWorkspace>

              <section aria-labelledby="analyst-conversation-title" className="mx-auto w-full max-w-3xl py-2">
                <p className="sr-only" aria-live="polite">
                  {isResponding
                    ? "Analysis in progress"
                    : messages.at(-1)?.role === "assistant"
                      ? "Analysis complete"
                      : ""}
                </p>
                <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <LineChart className="size-4" aria-hidden="true" />
                  <h2 id="analyst-conversation-title" className="font-medium text-foreground">
                    AI analyst
                  </h2>
                  <span aria-live="polite" className="text-xs">
                    {isResponding ? "Analyzing market context…" : `Grounded in ${activeTicker} data`}
                  </span>
                </div>

                {messages.length === 0 ? (
                  <div className="flex flex-col items-center gap-4 rounded-xl border border-white/10 bg-black/20 p-6 text-center backdrop-blur-sm">
                    <Persona state={personaState} variant="halo" className="size-16" />
                    <div>
                      <p className="text-sm font-medium">Ask about {activeTicker}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        The assistant will use the loaded quote, news, earnings, ratings, and financials.
                      </p>
                    </div>
                    <div className="grid w-full gap-2 sm:grid-cols-2">
                      {SUGGESTED_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => {
                            setChatInput(prompt);
                            chatInputRef.current?.focus();
                          }}
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message, index) => (
                      <FinanceMessage
                        key={message.id}
                        message={message}
                        isLast={index === messages.length - 1}
                        isStreaming={isResponding && index === messages.length - 1}
                        personaState={personaState}
                      />
                    ))}
                    {isResponding && messages.at(-1)?.role === "user" && (
                      <div className="flex items-start gap-3" role="status" aria-live="polite">
                        <div className="size-12 shrink-0">
                          <Persona state="thinking" variant="halo" className="size-full" />
                        </div>
                        <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                          Building the analysis…
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </section>
            </div>
          )}
        </main>

        <AppFooter>
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <label htmlFor="finance-chat-input" className="sr-only">
              Ask the finance analyst
            </label>
            <input
              ref={chatInputRef}
              id="finance-chat-input"
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              placeholder={activeTicker ? `Ask about ${activeTicker}…` : "Select a ticker to begin…"}
              disabled={!activeTicker || isResponding}
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-4 py-2 text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-white/30"
            />
            {isResponding ? (
              <button
                type="button"
                onClick={stopResponse}
                aria-label="Stop analysis"
                title="Stop analysis"
                className="inline-flex size-9 items-center justify-center rounded-md border border-white/10 bg-white/10 text-foreground transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                <Square className="size-3.5 fill-current" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!activeTicker || !chatInput.trim()}
                aria-label="Send analysis request"
                title="Send analysis request"
                className="inline-flex size-9 items-center justify-center rounded-md border border-white/10 bg-white/10 text-foreground transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                <Send className="size-4" aria-hidden="true" />
              </button>
            )}
          </form>
        </AppFooter>
      </AppMain>

      <StatusToast
        visible={Boolean(banner)}
        live={banner?.tone === "error" ? "assertive" : "polite"}
        className={banner?.tone === "error" ? "border-red-400/20 text-red-300" : undefined}
      >
        {banner?.text ?? ""}
      </StatusToast>
    </AppShell>
  );
}

interface MarketSnapshotProps {
  quote: QuoteData | null;
  period: ChartPeriod;
  pendingPeriod: ChartPeriod | null;
  chartData: ReturnType<typeof useFinanceData>["chartData"];
  chartLoading: boolean;
  chartError: string | null;
  indicators: IndicatorConfig;
  comparisons: ComparisonTicker[];
  comparisonPeriod: ChartPeriod | null;
  comparisonInput: string;
  comparisonLoading: boolean;
  comparisonError: string | null;
  shareStatus: "idle" | "copied" | "error";
  onPeriodChange: (period: ChartPeriod) => void;
  onToggleIndicator: (indicator: keyof IndicatorConfig) => void;
  onComparisonInputChange: (value: string) => void;
  onAddComparison: (event?: FormEvent) => void;
  onRemoveComparison: (symbol: string) => void;
  onShare: () => void;
  onDismissError: () => void;
}

function MarketSnapshot({
  quote,
  period,
  pendingPeriod,
  chartData,
  chartLoading,
  chartError,
  indicators,
  comparisons,
  comparisonPeriod,
  comparisonInput,
  comparisonLoading,
  comparisonError,
  shareStatus,
  onPeriodChange,
  onToggleIndicator,
  onComparisonInputChange,
  onAddComparison,
  onRemoveComparison,
  onShare,
  onDismissError,
}: MarketSnapshotProps) {
  if (!quote) return null;
  const positive = quote.change >= 0;
  const visibleComparisons = comparisonLoading || comparisonPeriod !== period ? [] : comparisons;
  const selectedPeriod = pendingPeriod ?? period;

  return (
    <section aria-labelledby="market-snapshot-title" className="overflow-hidden rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 id="market-snapshot-title" className="text-lg font-semibold">
              {quote.symbol}
            </h2>
            <span className="truncate text-sm text-muted-foreground">{quote.name}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <span className="text-2xl font-semibold tracking-tight tabular-nums">
              {formatCurrency(quote.price, quote.currency)}
            </span>
            <span className={`text-sm font-medium tabular-nums ${positive ? "text-emerald-400" : "text-red-400"}`}>
              {positive ? "▲" : "▼"} {positive ? "+" : ""}{quote.change.toFixed(2)} ({positive ? "+" : ""}{quote.changePercent.toFixed(2)}%)
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onShare}
          aria-label="Copy finance workspace share link"
          className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          {shareStatus === "copied" ? <Check className="size-4 text-emerald-400" aria-hidden="true" /> : <Share2 className="size-4" aria-hidden="true" />}
          {shareStatus === "copied" ? "Copied" : shareStatus === "error" ? "Retry" : "Share"}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
        <div className="flex items-center gap-1 overflow-x-auto" aria-label="Chart period">
          {PERIODS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onPeriodChange(item)}
              aria-pressed={selectedPeriod === item}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${selectedPeriod === item ? "bg-white/10 text-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"}`}
            >
              {PERIOD_LABELS[item]}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{quote.currency}</span>
      </div>

      <div className="relative h-72 min-h-64 md:h-80">
        {chartData.length > 0 && (
          <StockChart
            data={chartData}
            period={period}
            indicators={comparisons.length === 0 ? indicators : undefined}
            comparisonData={visibleComparisons.length > 0 ? visibleComparisons : undefined}
          />
        )}
        {chartLoading && (
          <div role="status" aria-live="polite" className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Refreshing market data…
            </div>
          </div>
        )}
        <p className="sr-only">
          {quote.symbol} is trading at {formatCurrency(quote.price, quote.currency)}, {positive ? "up" : "down"} {Math.abs(quote.changePercent).toFixed(2)} percent.
        </p>
      </div>

      {chartError && (
        <div role="alert" className="flex items-center gap-3 border-t border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">{chartError}</span>
          <button type="button" onClick={onDismissError} aria-label="Dismiss chart error" className="rounded p-1 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="grid gap-3 border-t border-white/10 p-3 lg:grid-cols-[1fr_auto]">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Indicators</span>
            {comparisons.length > 0 && <span className="text-xs text-muted-foreground">Disabled while comparing</span>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {INDICATOR_LABELS.map((indicator) => (
              <button
                key={indicator.key}
                type="button"
                onClick={() => onToggleIndicator(indicator.key)}
                disabled={comparisons.length > 0}
                aria-pressed={indicators[indicator.key]}
                title={comparisons.length > 0 ? "Remove comparisons to use technical indicators" : `Toggle ${indicator.label}`}
                className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${indicators[indicator.key] && comparisons.length === 0 ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-200" : "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"} disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {indicator.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-0 lg:w-80">
          <span className="mb-2 block text-xs font-medium text-muted-foreground">Compare up to four tickers</span>
          <form onSubmit={onAddComparison} className="flex gap-2">
            <label htmlFor="comparison-symbol" className="sr-only">Comparison ticker</label>
            <input
              id="comparison-symbol"
              value={comparisonInput}
              onChange={(event) => onComparisonInputChange(event.target.value.toUpperCase())}
              disabled={chartLoading || pendingPeriod !== null}
              placeholder="MSFT"
              maxLength={10}
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-3 py-1.5 text-sm uppercase outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-white/30"
            />
            <button
              type="submit"
              disabled={comparisonLoading || chartLoading || pendingPeriod !== null || !comparisonInput.trim()}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            >
              {comparisonLoading && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
              Add
            </button>
          </form>
        </div>
      </div>

      {(comparisons.length > 0 || comparisonError) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-3 py-2" aria-live="polite">
          {comparisons.map((comparison) => (
            <span key={comparison.symbol} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs">
              <span className="size-2 rounded-full" style={{ backgroundColor: comparison.color }} aria-hidden="true" />
              <span>{comparison.symbol}</span>
              <span className={comparison.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}>
                {comparison.changePercent >= 0 ? "+" : ""}{comparison.changePercent.toFixed(2)}%
              </span>
              <button type="button" onClick={() => onRemoveComparison(comparison.symbol)} aria-label={`Remove ${comparison.symbol} comparison`} className="rounded-full p-0.5 text-muted-foreground hover:bg-white/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30">
                <X className="size-3" aria-hidden="true" />
              </button>
            </span>
          ))}
          {comparisonError && <span className="text-xs text-red-300">{comparisonError}</span>}
        </div>
      )}
    </section>
  );
}

interface ResearchWorkspaceProps {
  activeTab: ResearchTab | null;
  onTabChange: (tab: ResearchTab) => void;
  quote: QuoteData | null;
  metrics: KeyMetrics | null;
  news: NewsItem[];
  children: ReactNode;
}

function ResearchWorkspace({ activeTab, onTabChange, quote, metrics, news, children }: ResearchWorkspaceProps) {
  return (
    <section aria-labelledby="research-title" className="rounded-xl border border-white/10 bg-black/30 backdrop-blur-sm">
      <div className="flex items-center gap-2 overflow-x-auto p-2" aria-label="Market research panels">
        <h2 id="research-title" className="sr-only">Market research</h2>
        {RESEARCH_TABS.map((tab) => (
          <button
            key={tab.key}
            id={`research-tab-${tab.key}`}
            type="button"
            aria-expanded={activeTab === tab.key}
            aria-controls={activeTab === tab.key ? `research-panel-${tab.key}` : undefined}
            onClick={() => onTabChange(tab.key)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${activeTab === tab.key ? "bg-white/10 text-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
        <span className="ml-auto hidden text-xs text-muted-foreground lg:block">Select again to collapse</span>
      </div>

      {activeTab && (
        <div id={`research-panel-${activeTab}`} role="region" aria-labelledby={`research-tab-${activeTab}`} className="max-h-[34rem] overflow-auto border-t border-white/10 p-4">
          {activeTab === "overview" && <OverviewPanel quote={quote} metrics={metrics} />}
          {activeTab === "news" && <NewsPanel news={news} />}
          {(activeTab === "financials" || activeTab === "earnings" || activeTab === "ratings") && children}
        </div>
      )}
    </section>
  );
}

function OverviewPanel({ quote, metrics }: { quote: QuoteData | null; metrics: KeyMetrics | null }) {
  if (!quote || !metrics) {
    return <EmptyResearch icon={<BarChart3 className="size-8" aria-hidden="true" />} text="Overview data is not available for this ticker." />;
  }
  const rangePosition = calculateRangePosition(
    quote.price,
    metrics.fiftyTwoWeekLow,
    metrics.fiftyTwoWeekHigh,
  );

  const values = [
    ["Market cap", formatLargeNumber(metrics.marketCap)],
    ["P/E ratio", metrics.peRatio?.toFixed(2) ?? "N/A"],
    ["Forward P/E", metrics.forwardPE?.toFixed(2) ?? "N/A"],
    ["Dividend yield", metrics.dividendYield != null ? `${(metrics.dividendYield * 100).toFixed(2)}%` : "N/A"],
    ["Average volume", formatLargeNumber(metrics.avgVolume)],
    ["Beta", metrics.beta?.toFixed(2) ?? "N/A"],
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
      <dl className="grid gap-2 sm:grid-cols-2">
        {values.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-sm font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-4 rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>52-week low</span>
            <span>52-week high</span>
          </div>
          <div className="relative mt-3 h-2 rounded-full bg-white/10">
            {rangePosition != null && (
              <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-neutral-950 bg-cyan-300" style={{ left: `${rangePosition}%` }} aria-hidden="true" />
            )}
          </div>
          <div className="mt-2 flex items-center justify-between text-sm tabular-nums">
            <span>{formatCurrency(metrics.fiftyTwoWeekLow, quote.currency)}</span>
            <span>{formatCurrency(metrics.fiftyTwoWeekHigh, quote.currency)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-white/10 pt-4">
          <div>
            <p className="text-xs text-muted-foreground">Analyst consensus</p>
            <p className="mt-1 text-lg font-semibold capitalize">{metrics.analystRating || "Not available"}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Target price</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{formatCurrency(metrics.targetPrice, quote.currency)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewsPanel({ news }: { news: NewsItem[] }) {
  if (news.length === 0) {
    return <EmptyResearch icon={<Newspaper className="size-8" aria-hidden="true" />} text="No recent market news was returned." />;
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {news.map((item, index) => (
        <a key={`${item.link}-${index}`} href={item.link} target="_blank" rel="noopener noreferrer" className="group rounded-lg border border-white/10 bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30">
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span className="truncate">{item.publisher || "Market news"}</span>
            <span className="shrink-0">{timeAgo(item.publishTime)}</span>
          </div>
          <h3 className="mt-2 text-sm font-medium leading-snug group-hover:text-cyan-200">{item.title}</h3>
        </a>
      ))}
    </div>
  );
}

function EmptyResearch({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
      {icon}
      <p className="text-sm">{text}</p>
    </div>
  );
}

function FinanceMessage({ message, isLast, isStreaming, personaState }: { message: Message; isLast: boolean; isStreaming: boolean; personaState: PersonaState }) {
  const parts = useMemo(() => splitChatContent(message.content), [message.content]);

  if (message.role === "user") {
    return (
      <div className="flex w-full justify-end">
        <div className="min-w-0 max-w-[85%] rounded-xl bg-white/10 px-4 py-3 text-foreground backdrop-blur-sm">
          <MarkdownMessage content={message.content} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 items-start gap-3">
      <div className="mt-0.5 size-12 shrink-0">
        {isLast && <Persona state={personaState} variant="halo" className="size-full" />}
      </div>
      <div className="min-w-0 max-w-[85%] text-foreground">
        {parts.reasoningContent && (
          <Reasoning isStreaming={isStreaming && !parts.reasoningComplete} defaultOpen={!parts.reasoningComplete}>
            <ReasoningTrigger />
            <ReasoningContent>{parts.reasoningContent}</ReasoningContent>
          </Reasoning>
        )}
        {parts.visibleContent ? (
          <MarkdownMessage content={parts.visibleContent} />
        ) : isStreaming ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Analyzing…
          </div>
        ) : null}
      </div>
    </div>
  );
}
