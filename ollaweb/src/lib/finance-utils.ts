import type { ChartPeriod } from './types';

const FINANCE_PERIODS: readonly ChartPeriod[] = ['1d', '5d', '1mo', '3mo', '1y', '5y'];
const TICKER_PATTERN = /^[A-Z0-9.\-^]{1,10}$/;
const DEFAULT_PERIOD: ChartPeriod = '1mo';
const MAX_SHARED_PROMPT_LENGTH = 500;

type SearchParamsReader = Pick<URLSearchParams, 'get'>;

export interface FinanceShareParams {
  ticker: string;
  period: ChartPeriod;
  prompt: string | null;
}

export interface ComparisonValidationResult {
  symbol: string;
  error: string | null;
}

export function parseFinanceShareParams(
  params: SearchParamsReader,
): FinanceShareParams | null {
  const ticker = params.get('sym')?.trim().toUpperCase() ?? '';
  if (!TICKER_PATTERN.test(ticker)) return null;

  const requestedPeriod = params.get('p');
  const period = FINANCE_PERIODS.includes(requestedPeriod as ChartPeriod)
    ? requestedPeriod as ChartPeriod
    : DEFAULT_PERIOD;
  const prompt = params.get('q')?.trim().slice(0, MAX_SHARED_PROMPT_LENGTH) || null;

  return { ticker, period, prompt };
}

export function formatCurrency(
  value: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (!Number.isFinite(value) || !currency?.trim()) return 'N/A';

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.trim().toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value as number);
  } catch {
    return 'N/A';
  }
}

export function calculateRangePosition(
  price: number | null | undefined,
  low: number | null | undefined,
  high: number | null | undefined,
): number | null {
  if (!Number.isFinite(price) || !Number.isFinite(low) || !Number.isFinite(high)) {
    return null;
  }

  const finitePrice = price as number;
  const finiteLow = low as number;
  const finiteHigh = high as number;
  if (finiteHigh <= finiteLow) return null;

  const position = ((finitePrice - finiteLow) / (finiteHigh - finiteLow)) * 100;
  return Math.min(100, Math.max(0, position));
}

export function validateComparisonSymbol(
  input: string,
  active: string,
  existing: readonly string[],
  max = 4,
): ComparisonValidationResult {
  const symbol = input.trim().toUpperCase();
  const activeSymbol = active.trim().toUpperCase();
  const existingSymbols = existing.map((item) => item.trim().toUpperCase());

  if (!TICKER_PATTERN.test(symbol)) {
    return { symbol, error: 'Enter a valid ticker symbol.' };
  }
  if (symbol === activeSymbol) {
    return { symbol, error: `${symbol} is already the active ticker.` };
  }
  if (existingSymbols.includes(symbol)) {
    return { symbol, error: `${symbol} is already being compared.` };
  }
  if (existing.length >= max) {
    return { symbol, error: `You can compare up to ${max} tickers.` };
  }

  return { symbol, error: null };
}
