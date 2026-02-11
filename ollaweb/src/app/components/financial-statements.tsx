"use client";

import { useState, useEffect, useCallback } from 'react';
import type { FinancialStatementsData, StatementType, StatementPeriodType } from '../../lib/types';

interface FinancialStatementsProps {
  ticker: string;
}

const TABS: { key: StatementType; label: string }[] = [
  { key: 'income', label: 'Income' },
  { key: 'balance', label: 'Balance' },
  { key: 'cashflow', label: 'Cash Flow' },
];

function formatValue(v: number | null): string {
  if (v == null) return '—';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

export function FinancialStatements({ ticker }: FinancialStatementsProps) {
  const [statementType, setStatementType] = useState<StatementType>('income');
  const [periodType, setPeriodType] = useState<StatementPeriodType>('annual');
  const [data, setData] = useState<FinancialStatementsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!ticker) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/finance/fundamentals?ticker=${encodeURIComponent(ticker)}&statement=${statementType}&periodType=${periodType}`
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to load data');
        setData(null);
        return;
      }
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [ticker, statementType, periodType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!ticker) {
    return (
      <div className="flex items-center justify-center h-full text-retro-border-light text-xs">
        Load a ticker to view financial statements
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-retro-border-light shrink-0">
        {TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatementType(tab.key)}
            className={`px-2 py-0.5 text-xs ${
              statementType === tab.key
                ? 'retro-sunken bg-retro-panel text-retro-green'
                : 'retro-raised bg-retro-surface text-retro-text hover:text-retro-text-bright'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => setPeriodType('annual')}
            className={`px-2 py-0.5 text-xs ${
              periodType === 'annual'
                ? 'retro-sunken bg-retro-panel text-retro-amber'
                : 'retro-raised bg-retro-surface text-retro-text hover:text-retro-text-bright'
            }`}
          >
            Annual
          </button>
          <button
            type="button"
            onClick={() => setPeriodType('quarterly')}
            className={`px-2 py-0.5 text-xs ${
              periodType === 'quarterly'
                ? 'retro-sunken bg-retro-panel text-retro-amber'
                : 'retro-raised bg-retro-surface text-retro-text hover:text-retro-text-bright'
            }`}
          >
            Qtrly
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <span className="text-retro-cyan retro-blink text-sm">Loading financial data...</span>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center py-8">
            <span className="text-retro-red text-xs">[ERROR] {error}</span>
          </div>
        )}
        {data && !loading && (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-retro-border-light">
                <th className="text-left text-retro-amber px-3 py-1.5 sticky left-0 bg-retro-surface">Item</th>
                {data.periods.map((p, i) => (
                  <th key={i} className="text-right text-retro-amber px-2 py-1.5 whitespace-nowrap">{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => {
                const isHighlight = ['Gross Profit', 'Operating Income', 'Net Income', 'EBITDA',
                  'Total Assets', "Stockholders' Equity", 'Free Cash Flow', 'Operating Cash Flow',
                  'Total Revenue', 'Diluted EPS'].includes(row.label);
                return (
                  <tr
                    key={row.key}
                    className={`border-b border-retro-border-dark ${
                      isHighlight ? 'bg-retro-panel' : ''
                    } ${i % 2 === 0 ? '' : 'bg-opacity-50'}`}
                  >
                    <td className={`text-left px-3 py-1 sticky left-0 ${
                      isHighlight ? 'text-retro-green bg-retro-panel font-bold' : 'text-retro-text bg-retro-surface'
                    }`}>
                      {row.label}
                    </td>
                    {row.values.map((v, j) => (
                      <td
                        key={j}
                        className={`text-right px-2 py-1 font-mono whitespace-nowrap ${
                          v != null && v < 0 ? 'text-retro-red' : 'text-retro-text-bright'
                        }`}
                      >
                        {formatValue(v)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
