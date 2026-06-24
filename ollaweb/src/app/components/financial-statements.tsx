"use client";

import { useState, useEffect, useCallback } from 'react';
import { BarChart4, AlertCircle } from 'lucide-react';
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
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4 opacity-30">
        <BarChart4 size={48} />
        <p className="text-xs font-bold uppercase tracking-widest">Select an asset to view fundamentals</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]/30">
      {/* Search/Filter Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#333] shrink-0 bg-[#0a0a0a]/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center gap-1 bg-[#171717]/50 rounded-xl p-1 border border-[#333]">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatementType(tab.key)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                statementType === tab.key
                  ? 'bg-[#2f2f2f] text-white shadow-sm ring-1 ring-white/5'
                  : 'text-muted-foreground hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-[#171717]/50 rounded-xl p-1 border border-[#333]">
          {[
            { key: 'annual' as const, label: 'Annual' },
            { key: 'quarterly' as const, label: 'Quarterly' }
          ].map(p => (
            <button
              key={p.key}
              onClick={() => setPeriodType(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                periodType === p.key
                  ? 'bg-white/10 text-white'
                  : 'text-muted-foreground hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto custom-scrollbar relative">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a]/50 backdrop-blur-[2px] z-30">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] animate-pulse">Aggregating Financials...</span>
            </div>
          </div>
        )}
        
        {error && (
          <div className="flex items-center justify-center p-8 h-full">
            <div className="max-w-md bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-2xl flex items-center gap-4">
              <AlertCircle size={24} />
              <div>
                <p className="text-sm font-bold">Data Fetching Failed</p>
                <p className="text-xs opacity-80">{error}</p>
              </div>
            </div>
          </div>
        )}

        {data && !loading && (
          <div className="min-w-full inline-block align-middle">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-[#171717]/30">
                  <th className="text-left text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground px-6 py-4 sticky left-0 bg-[#0a0a0a] border-b border-[#333] z-10">Financial Item</th>
                  {data.periods.map((p, i) => (
                    <th key={i} className="text-right text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground px-4 py-4 border-b border-[#333] whitespace-nowrap">
                      {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f1f1f]">
                {data.rows.map((row, i) => {
                  const isHighlight = ['Gross Profit', 'Operating Income', 'Net Income', 'EBITDA',
                    'Total Assets', "Stockholders' Equity", 'Free Cash Flow', 'Operating Cash Flow',
                    'Total Revenue', 'Diluted EPS'].includes(row.label);
                  return (
                    <tr
                      key={row.key}
                      className={`group hover:bg-white/[0.02] transition-colors ${
                        isHighlight ? 'bg-white/[0.01]' : ''
                      }`}
                    >
                      <td className={`text-left px-6 py-3 sticky left-0 z-10 border-r border-[#1f1f1f] ${
                        isHighlight 
                          ? 'bg-[#111] text-white font-bold text-sm' 
                          : 'bg-[#0a0a0a] text-muted-foreground text-xs group-hover:text-foreground transition-colors'
                      }`}>
                        {row.label}
                      </td>
                      {row.values.map((v, j) => (
                        <td
                          key={j}
                          className={`text-right px-4 py-3 font-mono text-xs tabular-nums ${
                            v != null && v < 0 ? 'text-red-400' : 'text-gray-300'
                          } ${isHighlight ? 'font-bold' : ''}`}
                        >
                          {formatValue(v)}
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
    </div>
  );
}
