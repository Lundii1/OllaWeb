"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AnalystData,
  ChartDataPoint,
  ChartPeriod,
  EarningsData,
  FinancialStatementsData,
  KeyMetrics,
  NewsItem,
  QuoteData,
  StatementPeriodType,
  StatementType,
} from "../../lib/types";

export interface AsyncResource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface QuotePayload extends QuoteData {
  chartData: ChartDataPoint[];
  news?: NewsItem[];
  metrics?: KeyMetrics | null;
}

export interface QuoteLoadResult {
  ok: boolean;
  changed: boolean;
  symbol?: string;
  error?: string;
}

const idleResource = <T,>(): AsyncResource<T> => ({
  data: null,
  loading: false,
  error: null,
});

const financialKey = (
  ticker: string,
  statement: StatementType,
  periodType: StatementPeriodType,
) => `${ticker}:${statement}:${periodType}`;

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error || "Request failed");
  }
  return body as T;
}

export function useFinanceData() {
  const [activeTicker, setActiveTicker] = useState("");
  const activeTickerRef = useRef("");
  const [period, setPeriod] = useState<ChartPeriod>("1mo");
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [metrics, setMetrics] = useState<KeyMetrics | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);

  const [earnings, setEarnings] = useState<AsyncResource<EarningsData>>(idleResource);
  const [analyst, setAnalyst] = useState<AsyncResource<AnalystData>>(idleResource);
  const earningsCacheRef = useRef(new Map<string, EarningsData>());
  const analystCacheRef = useRef(new Map<string, AnalystData>());

  const [financialResources, setFinancialResources] = useState<
    Record<string, AsyncResource<FinancialStatementsData>>
  >({});
  const financialResourcesRef = useRef(financialResources);
  const financialRequestsRef = useRef(
    new Map<string, Promise<FinancialStatementsData | null>>(),
  );

  const quoteControllerRef = useRef<AbortController | null>(null);
  const contextControllerRef = useRef<AbortController | null>(null);
  const quoteSequenceRef = useRef(0);
  const contextSequenceRef = useRef(0);

  const updateFinancialResource = useCallback(
    (key: string, resource: AsyncResource<FinancialStatementsData>) => {
      financialResourcesRef.current = {
        ...financialResourcesRef.current,
        [key]: resource,
      };
      setFinancialResources(financialResourcesRef.current);
    },
    [],
  );

  const fetchFinancials = useCallback(
    async (
      ticker: string,
      statement: StatementType,
      periodType: StatementPeriodType,
      signal?: AbortSignal,
    ): Promise<FinancialStatementsData | null> => {
      if (!ticker) return null;
      const key = financialKey(ticker, statement, periodType);
      const cached = financialResourcesRef.current[key];
      if (cached?.data) return cached.data;

      const pending = financialRequestsRef.current.get(key);
      if (pending) return pending;

      updateFinancialResource(key, {
        data: cached?.data ?? null,
        loading: true,
        error: null,
      });

      const request = fetch(
        `/api/finance/fundamentals?ticker=${encodeURIComponent(ticker)}&statement=${statement}&periodType=${periodType}`,
        { signal },
      )
        .then((response) => readResponse<FinancialStatementsData>(response))
        .then((data) => {
          updateFinancialResource(key, { data, loading: false, error: null });
          return data;
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            updateFinancialResource(key, {
              data: financialResourcesRef.current[key]?.data ?? null,
              loading: false,
              error: null,
            });
            return null;
          }
          const message = error instanceof Error ? error.message : "Unable to load financials";
          updateFinancialResource(key, { data: null, loading: false, error: message });
          return null;
        })
        .finally(() => {
          financialRequestsRef.current.delete(key);
        });

      financialRequestsRef.current.set(key, request);
      return request;
    },
    [updateFinancialResource],
  );

  const primeTickerContext = useCallback(
    (ticker: string) => {
      contextControllerRef.current?.abort();
      const controller = new AbortController();
      contextControllerRef.current = controller;
      const sequence = ++contextSequenceRef.current;

      const cachedEarnings = earningsCacheRef.current.get(ticker);
      const cachedAnalyst = analystCacheRef.current.get(ticker);

      setEarnings(
        cachedEarnings
          ? { data: cachedEarnings, loading: false, error: null }
          : { data: null, loading: true, error: null },
      );
      setAnalyst(
        cachedAnalyst
          ? { data: cachedAnalyst, loading: false, error: null }
          : { data: null, loading: true, error: null },
      );

      if (!cachedEarnings) {
        fetch(`/api/finance/earnings?ticker=${encodeURIComponent(ticker)}`, {
          signal: controller.signal,
        })
          .then((response) => readResponse<EarningsData>(response))
          .then((data) => {
            earningsCacheRef.current.set(ticker, data);
            if (sequence === contextSequenceRef.current && activeTickerRef.current === ticker) {
              setEarnings({ data, loading: false, error: null });
            }
          })
          .catch((error: unknown) => {
            if (error instanceof DOMException && error.name === "AbortError") return;
            if (sequence === contextSequenceRef.current && activeTickerRef.current === ticker) {
              setEarnings({
                data: null,
                loading: false,
                error: error instanceof Error ? error.message : "Unable to load earnings",
              });
            }
          });
      }

      if (!cachedAnalyst) {
        fetch(`/api/finance/analysis?ticker=${encodeURIComponent(ticker)}`, {
          signal: controller.signal,
        })
          .then((response) => readResponse<AnalystData>(response))
          .then((data) => {
            analystCacheRef.current.set(ticker, data);
            if (sequence === contextSequenceRef.current && activeTickerRef.current === ticker) {
              setAnalyst({ data, loading: false, error: null });
            }
          })
          .catch((error: unknown) => {
            if (error instanceof DOMException && error.name === "AbortError") return;
            if (sequence === contextSequenceRef.current && activeTickerRef.current === ticker) {
              setAnalyst({
                data: null,
                loading: false,
                error: error instanceof Error ? error.message : "Unable to load analyst data",
              });
            }
          });
      }

      void Promise.all(
        (["income", "balance", "cashflow"] as StatementType[]).map((statement) =>
          fetchFinancials(ticker, statement, "annual", controller.signal),
        ),
      );
    },
    [fetchFinancials],
  );

  const loadTicker = useCallback(
    async (
      rawTicker: string,
      requestedPeriod: ChartPeriod = period,
      refreshContext = true,
    ): Promise<QuoteLoadResult> => {
      const ticker = rawTicker.trim().toUpperCase();
      if (!ticker) {
        return { ok: false, changed: false, error: "Enter a ticker symbol" };
      }

      quoteControllerRef.current?.abort();
      const controller = new AbortController();
      quoteControllerRef.current = controller;
      const sequence = ++quoteSequenceRef.current;
      setChartLoading(true);
      setChartError(null);

      try {
        const response = await fetch(
          `/api/finance/quote?ticker=${encodeURIComponent(ticker)}&period=${requestedPeriod}`,
          { signal: controller.signal },
        );
        const payload = await readResponse<QuotePayload>(response);
        if (sequence !== quoteSequenceRef.current) {
          return { ok: false, changed: false };
        }

        const changed = payload.symbol !== activeTickerRef.current;
        activeTickerRef.current = payload.symbol;
        setActiveTicker(payload.symbol);
        setPeriod(requestedPeriod);
        setQuoteData({
          symbol: payload.symbol,
          name: payload.name,
          price: payload.price,
          change: payload.change,
          changePercent: payload.changePercent,
          currency: payload.currency,
        });
        setChartData(payload.chartData ?? []);
        setNews(payload.news ?? []);
        setMetrics(payload.metrics ?? null);
        setChartError(null);

        if (changed || refreshContext) {
          primeTickerContext(payload.symbol);
        }

        return { ok: true, changed, symbol: payload.symbol };
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return { ok: false, changed: false };
        }
        const message = error instanceof Error ? error.message : "Unable to load market data";
        if (sequence === quoteSequenceRef.current) setChartError(message);
        return { ok: false, changed: false, error: message };
      } finally {
        if (sequence === quoteSequenceRef.current) setChartLoading(false);
      }
    },
    [period, primeTickerContext],
  );

  const getFinancialResource = useCallback(
    (statement: StatementType, periodType: StatementPeriodType) => {
      if (!activeTicker) return idleResource<FinancialStatementsData>();
      return (
        financialResources[financialKey(activeTicker, statement, periodType)] ??
        idleResource<FinancialStatementsData>()
      );
    },
    [activeTicker, financialResources],
  );

  const financialContext = useMemo(() => {
    if (!activeTicker) return null;
    return {
      income: financialResources[financialKey(activeTicker, "income", "annual")]?.data ?? null,
      balance: financialResources[financialKey(activeTicker, "balance", "annual")]?.data ?? null,
      cashflow: financialResources[financialKey(activeTicker, "cashflow", "annual")]?.data ?? null,
    };
  }, [activeTicker, financialResources]);

  useEffect(() => {
    return () => {
      quoteControllerRef.current?.abort();
      contextControllerRef.current?.abort();
    };
  }, []);

  return {
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
    clearChartError: () => setChartError(null),
  };
}
