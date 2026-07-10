"use client";

import { AlertCircle, BarChart4, Loader2 } from "lucide-react";
import type {
  FinancialStatementsData,
  StatementPeriodType,
  StatementType,
} from "../../lib/types";

export type FinancialStatementsPanelData = FinancialStatementsData;

export interface FinancialStatementsProps {
  ticker: string;
  data?: FinancialStatementsData | null;
  loading?: boolean;
  error?: string | null;
  statementType: StatementType;
  periodType: StatementPeriodType;
  onStatementTypeChange: (statement: StatementType) => void;
  onPeriodTypeChange: (period: StatementPeriodType) => void;
}

const STATEMENTS: { key: StatementType; label: string }[] = [
  { key: "income", label: "Income" },
  { key: "balance", label: "Balance sheet" },
  { key: "cashflow", label: "Cash flow" },
];

const PERIODS: { key: StatementPeriodType; label: string }[] = [
  { key: "annual", label: "Annual" },
  { key: "quarterly", label: "Quarterly" },
];

const HIGHLIGHT_ROWS = new Set([
  "Gross Profit",
  "Operating Income",
  "Net Income",
  "EBITDA",
  "Total Assets",
  "Stockholders' Equity",
  "Free Cash Flow",
  "Operating Cash Flow",
  "Total Revenue",
  "Diluted EPS",
]);

function formatValue(value: number | null): string {
  if (value == null) return "—";
  const absolute = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (absolute >= 1e12) return `${sign}$${(absolute / 1e12).toFixed(2)}T`;
  if (absolute >= 1e9) return `${sign}$${(absolute / 1e9).toFixed(2)}B`;
  if (absolute >= 1e6) return `${sign}$${(absolute / 1e6).toFixed(2)}M`;
  if (absolute >= 1e3) return `${sign}$${(absolute / 1e3).toFixed(1)}K`;
  return `${sign}$${absolute.toFixed(2)}`;
}

export function FinancialStatements({
  ticker,
  data = null,
  loading = false,
  error = null,
  statementType,
  periodType,
  onStatementTypeChange,
  onPeriodTypeChange,
}: FinancialStatementsProps) {
  if (!ticker) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
        <BarChart4 className="size-8" aria-hidden="true" />
        <p className="text-sm">Select a ticker to view fundamentals.</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-48 overflow-hidden rounded-lg border border-white/10 bg-black/20">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-3">
        <div className="flex items-center gap-1 overflow-x-auto" aria-label="Financial statement">
          {STATEMENTS.map((statement) => (
            <button
              key={statement.key}
              type="button"
              aria-pressed={statementType === statement.key}
              onClick={() => onStatementTypeChange(statement.key)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${statementType === statement.key ? "bg-white/10 text-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"}`}
            >
              {statement.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1" aria-label="Statement period">
          {PERIODS.map((statementPeriod) => (
            <button
              key={statementPeriod.key}
              type="button"
              aria-pressed={periodType === statementPeriod.key}
              onClick={() => onPeriodTypeChange(statementPeriod.key)}
              className={`rounded-md px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${periodType === statementPeriod.key ? "bg-white/10 text-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"}`}
            >
              {statementPeriod.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div role="status" aria-live="polite" className="absolute inset-x-0 bottom-0 top-[57px] z-20 flex items-center justify-center bg-black/55 backdrop-blur-[2px]">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading fundamentals…
          </div>
        </div>
      )}

      {error && !loading && (
        <div role="alert" className="m-4 flex items-start gap-3 rounded-lg border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-300">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">Financial data could not be loaded</p>
            <p className="mt-1 text-red-200/80">{error}</p>
          </div>
        </div>
      )}

      {!data && !loading && !error && (
        <div className="flex min-h-40 items-center justify-center p-6 text-sm text-muted-foreground">
          No statement data was returned.
        </div>
      )}

      {data && !error && (
        <div className="overflow-auto">
          <table className="w-full min-w-[680px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 top-0 z-10 border-b border-r border-white/10 bg-neutral-950/95 px-4 py-3 text-left text-xs font-medium text-muted-foreground backdrop-blur-sm">
                  Financial item
                </th>
                {data.periods.map((item) => (
                  <th key={item} scope="col" className="sticky top-0 border-b border-white/10 bg-neutral-950/95 px-4 py-3 text-right text-xs font-medium text-muted-foreground backdrop-blur-sm">
                    {item}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => {
                const highlighted = HIGHLIGHT_ROWS.has(row.label);
                return (
                  <tr key={row.key} className="group hover:bg-white/[0.03]">
                    <th scope="row" className={`sticky left-0 border-b border-r border-white/[0.06] px-4 py-3 text-left backdrop-blur-sm ${highlighted ? "bg-neutral-900/95 font-medium text-foreground" : "bg-neutral-950/95 font-normal text-muted-foreground group-hover:text-foreground"}`}>
                      {row.label}
                    </th>
                    {row.values.map((value, index) => (
                      <td key={`${row.key}-${data.periods[index] ?? index}`} className={`border-b border-white/[0.06] px-4 py-3 text-right font-mono text-xs tabular-nums ${value != null && value < 0 ? "text-red-300" : "text-foreground/85"} ${highlighted ? "font-semibold" : ""}`}>
                        {formatValue(value)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
