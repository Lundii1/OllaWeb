import YahooFinance from 'yahoo-finance2';

const yahooFinance = new (YahooFinance as any)();

const INCOME_KEYS = [
  { key: 'totalRevenue', label: 'Total Revenue' },
  { key: 'costOfRevenue', label: 'Cost of Revenue' },
  { key: 'grossProfit', label: 'Gross Profit' },
  { key: 'operatingExpense', label: 'Operating Expenses' },
  { key: 'operatingIncome', label: 'Operating Income' },
  { key: 'interestExpense', label: 'Interest Expense' },
  { key: 'pretaxIncome', label: 'Pretax Income' },
  { key: 'incomeTaxExpense', label: 'Income Tax' },
  { key: 'netIncome', label: 'Net Income' },
  { key: 'dilutedEPS', label: 'Diluted EPS' },
  { key: 'EBITDA', label: 'EBITDA' },
];

const BALANCE_KEYS = [
  { key: 'totalAssets', label: 'Total Assets' },
  { key: 'currentAssets', label: 'Current Assets' },
  { key: 'cashAndCashEquivalents', label: 'Cash & Equivalents' },
  { key: 'totalLiabilitiesNetMinorityInterest', label: 'Total Liabilities' },
  { key: 'currentLiabilities', label: 'Current Liabilities' },
  { key: 'longTermDebt', label: 'Long-Term Debt' },
  { key: 'totalDebt', label: 'Total Debt' },
  { key: 'stockholdersEquity', label: "Stockholders' Equity" },
  { key: 'retainedEarnings', label: 'Retained Earnings' },
  { key: 'workingCapital', label: 'Working Capital' },
];

const CASHFLOW_KEYS = [
  { key: 'operatingCashFlow', label: 'Operating Cash Flow' },
  { key: 'capitalExpenditure', label: 'Capital Expenditure' },
  { key: 'freeCashFlow', label: 'Free Cash Flow' },
  { key: 'investingCashFlow', label: 'Investing Cash Flow' },
  { key: 'financingCashFlow', label: 'Financing Cash Flow' },
  { key: 'changeInCashSupplementalAsReported', label: 'Net Change in Cash' },
  { key: 'repurchaseOfCapitalStock', label: 'Share Buybacks' },
  { key: 'commonStockDividendPaid', label: 'Dividends Paid' },
];

const STATEMENT_KEYS: Record<string, { key: string; label: string }[]> = {
  income: INCOME_KEYS,
  balance: BALANCE_KEYS,
  cashflow: CASHFLOW_KEYS,
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticker = url.searchParams.get('ticker')?.toUpperCase().trim();
  const statement = url.searchParams.get('statement') || 'income';
  const periodType = url.searchParams.get('periodType') || 'annual';

  if (!ticker || !/^[A-Z0-9.\-^]{1,10}$/.test(ticker)) {
    return Response.json({ error: 'Invalid ticker symbol' }, { status: 400 });
  }

  if (!['income', 'balance', 'cashflow'].includes(statement)) {
    return Response.json({ error: 'Invalid statement type. Use: income, balance, cashflow' }, { status: 400 });
  }

  if (!['annual', 'quarterly'].includes(periodType)) {
    return Response.json({ error: 'Invalid period type. Use: annual, quarterly' }, { status: 400 });
  }

  try {
    const period1 = new Date();
    period1.setFullYear(period1.getFullYear() - 5);

    const result = await yahooFinance.fundamentalsTimeSeries(ticker, {
      period1: period1.toISOString().split('T')[0],
      period2: new Date().toISOString().split('T')[0],
      type: periodType,
      module: statement === 'income' ? 'financials' : statement === 'balance' ? 'balance-sheet' : 'cash-flow',
    });

    if (!result || result.length === 0) {
      return Response.json({ error: `No ${statement} data found for "${ticker}"` }, { status: 404 });
    }

    // Sort by date descending (most recent first)
    const sorted = [...result].sort((a: any, b: any) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Take the most recent periods (up to 5 for annual, 8 for quarterly)
    const maxPeriods = periodType === 'annual' ? 5 : 8;
    const periods = sorted.slice(0, maxPeriods);

    // Format period labels
    const periodLabels = periods.map((p: any) => {
      const d = new Date(p.date);
      return periodType === 'annual'
        ? `FY${d.getFullYear()}`
        : `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}`;
    });

    // Build rows
    const keys = STATEMENT_KEYS[statement] || INCOME_KEYS;
    const rows = keys.map(({ key, label }) => ({
      label,
      key,
      values: periods.map((p: any) => {
        const val = p[key];
        return val != null ? val : null;
      }),
    }));

    return Response.json({
      periods: periodLabels,
      rows,
    });
  } catch (error) {
    console.error('[finance/fundamentals] Error:', error);
    return Response.json(
      { error: `Failed to fetch financial data: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
