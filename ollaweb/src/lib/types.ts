export type ChatMode = 'single' | 'council';

export type ConfidenceLevel = 'strong' | 'moderate' | 'mixed' | 'disagreement' | 'unknown';

export type CouncilEventType =
  | 'health_check'
  | 'individual_start'
  | 'individual_chunk'
  | 'individual_complete'
  | 'individual_error'
  | 'debate_start'
  | 'debate_chunk'
  | 'debate_complete'
  | 'synthesis_start'
  | 'synthesis_chunk'
  | 'synthesis_complete'
  | 'error';

export interface CouncilEvent {
  event: CouncilEventType;
  payload: Record<string, any>;
}

export interface IndividualResponse {
  model: string;
  index: number;
  text: string;
  status: 'pending' | 'streaming' | 'complete' | 'error';
  reasoning?: string;
  error?: string;
  errorAction?: string;
}

export interface CouncilState {
  phase: 'idle' | 'health_check' | 'individual' | 'debating' | 'synthesizing' | 'complete' | 'error';
  individualResponses: IndividualResponse[];
  consensusText: string;
  consensusReasoning?: string;
  moderatorModel: string;
  confidence?: ConfidenceLevel;
}

export interface CouncilConfig {
  models: [string, string, string];
  moderatorIndex: number;
}

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  councilData?: IndividualResponse[];
  councilConfidence?: ConfidenceLevel;
  image?: string;
};

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  chatMode: ChatMode;
  model: string;
  councilModels?: [string, string, string];
  moderatorIndex?: number;
  createdAt: number;
  updatedAt: number;
}

export const AVAILABLE_MODELS = [
  { value: 'nemotron-3-super:cloud', label: 'Nemotron 3 Super Cloud ☁️', vision: false },
  { value: 'gemma4:31b-cloud', label: 'Gemma 4 31B Cloud ☁️', vision: false },
  { value: 'minimax-m3:cloud', label: 'Minimax M3 Cloud ☁️', vision: false },
] as const;

// ── Finance Types ─────────────────────────────────────────────────

export interface ChartDataPoint {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface QuoteData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
}

export type ChartPeriod = '1d' | '5d' | '1mo' | '3mo' | '1y' | '5y';

export interface NewsItem {
  title: string;
  publisher: string;
  link: string;
  publishTime: number; // unix timestamp
}

export interface KeyMetrics {
  marketCap: number | null;
  peRatio: number | null;
  forwardPE: number | null;
  beta: number | null;
  dividendYield: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  avgVolume: number | null;
  targetPrice: number | null;
  analystRating: string | null;
}

// ── Watchlist Types ──────────────────────────────────────────────

export interface WatchlistItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}

// ── Technical Indicators Types ──────────────────────────────────

export type IndicatorType = 'sma' | 'ema' | 'rsi' | 'macd' | 'bollinger';

export interface IndicatorConfig {
  sma: boolean;
  ema: boolean;
  rsi: boolean;
  macd: boolean;
  bollinger: boolean;
}

export interface MACDData {
  time: number;
  macd: number | null;
  signal: number | null;
  histogram: number | null;
}

export interface RSIData {
  time: number;
  value: number | null;
}

export interface BollingerData {
  time: number;
  upper: number | null;
  middle: number | null;
  lower: number | null;
}

export interface IndicatorLineData {
  time: number;
  value: number | null;
}

// ── Financial Statements Types ──────────────────────────────────

export type StatementType = 'income' | 'balance' | 'cashflow';
export type StatementPeriodType = 'annual' | 'quarterly';

export interface FinancialStatementRow {
  label: string;
  key: string;
  values: (number | null)[];
}

export interface FinancialStatementsData {
  periods: string[];
  rows: FinancialStatementRow[];
}

// ── Earnings Types ──────────────────────────────────────────────

export interface EarningsHistoryItem {
  quarter: string;
  date: string;
  epsEstimate: number | null;
  epsActual: number | null;
  surprise: number | null;
  surprisePercent: number | null;
}

export interface EarningsTrendItem {
  period: string;
  endDate: string | null;
  epsEstimate: number | null;
  revenueEstimate: number | null;
  growth: number | null;
}

export interface EarningsData {
  nextEarningsDate: string | null;
  history: EarningsHistoryItem[];
  trend: EarningsTrendItem[];
  epsRevisions: {
    period: string;
    upLast7: number | null;
    upLast30: number | null;
    downLast7: number | null;
    downLast30: number | null;
  }[];
}

// ── Analyst Types ───────────────────────────────────────────────

export interface AnalystRecommendation {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  period: string;
}

export interface UpgradeDowngrade {
  firm: string;
  toGrade: string;
  fromGrade: string;
  action: string;
  date: string;
}

export interface AnalystData {
  recommendations: AnalystRecommendation[];
  upgradeDowngradeHistory: UpgradeDowngrade[];
  targetLow: number | null;
  targetMean: number | null;
  targetHigh: number | null;
  targetMedian: number | null;
  currentPrice: number | null;
  numberOfAnalysts: number | null;
}

// ── Comparison Types ────────────────────────────────────────────

export interface ComparisonTicker {
  symbol: string;
  data: ChartDataPoint[];
  color: string;
  changePercent: number;
}

export const COMPARISON_COLORS = ['#00d4ff', '#ffb000', '#ff3333', '#a855f7'] as const;

export const DEFAULT_COUNCIL_MODELS: [string, string, string] = [
  'nemotron-3-super:cloud',
  'gemma4:31b-cloud',
  'minimax-m3:cloud',
];
