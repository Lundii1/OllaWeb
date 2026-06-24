import { streamText } from 'ai';
import {
  ollama,
  ensureOllamaRunning,
  checkModelInstalled,
  installModel,
  runWebSearch,
} from '../../../../lib/ollama-utils';

function formatNum(n: number | null | undefined): string {
  if (n == null) return 'N/A';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${abs.toFixed(2)}`;
}

function buildFinancialContext(data: any): string {
  const sections: string[] = [];

  // Quote data
  if (data.quote) {
    const q = data.quote;
    sections.push(`=== CURRENT QUOTE ===
Symbol: ${q.symbol} | Name: ${q.name}
Price: $${q.price?.toFixed(2)} | Change: ${q.change >= 0 ? '+' : ''}${q.change?.toFixed(2)} (${q.changePercent >= 0 ? '+' : ''}${q.changePercent?.toFixed(2)}%)
Currency: ${q.currency}`);
  }

  // Key metrics
  if (data.metrics) {
    const m = data.metrics;
    sections.push(`=== KEY METRICS ===
Market Cap: ${formatNum(m.marketCap)}
P/E Ratio (Trailing): ${m.peRatio != null ? m.peRatio.toFixed(2) : 'N/A'}
Forward P/E: ${m.forwardPE != null ? m.forwardPE.toFixed(2) : 'N/A'}
Beta: ${m.beta != null ? m.beta.toFixed(2) : 'N/A'}
Dividend Yield: ${m.dividendYield != null ? (m.dividendYield * 100).toFixed(2) + '%' : 'N/A'}
52-Week High: ${m.fiftyTwoWeekHigh != null ? '$' + m.fiftyTwoWeekHigh.toFixed(2) : 'N/A'}
52-Week Low: ${m.fiftyTwoWeekLow != null ? '$' + m.fiftyTwoWeekLow.toFixed(2) : 'N/A'}
Avg Volume: ${formatNum(m.avgVolume)}
Analyst Target Price: ${m.targetPrice != null ? '$' + m.targetPrice.toFixed(2) : 'N/A'}
Analyst Rating: ${m.analystRating || 'N/A'}`);
  }

  // Earnings
  if (data.earnings) {
    const e = data.earnings;
    const lines = ['=== EARNINGS DATA ==='];
    if (e.nextEarningsDate) lines.push(`Next Earnings Date: ${e.nextEarningsDate}`);
    if (e.history?.length > 0) {
      lines.push('EPS History (Recent Quarters):');
      for (const h of e.history) {
        const surprise = h.surprisePercent != null ? ` (Surprise: ${h.surprisePercent >= 0 ? '+' : ''}${h.surprisePercent.toFixed(1)}%)` : '';
        lines.push(`  ${h.date || h.quarter}: Est ${h.epsEstimate?.toFixed(2) ?? 'N/A'} | Act ${h.epsActual?.toFixed(2) ?? 'N/A'}${surprise}`);
      }
    }
    if (e.trend?.length > 0) {
      lines.push('Forward Estimates:');
      for (const t of e.trend) {
        const growth = t.growth != null ? ` | Growth: ${t.growth >= 0 ? '+' : ''}${t.growth.toFixed(1)}%` : '';
        lines.push(`  ${t.period}: EPS Est ${t.epsEstimate?.toFixed(2) ?? 'N/A'} | Rev Est ${formatNum(t.revenueEstimate)}${growth}`);
      }
    }
    sections.push(lines.join('\n'));
  }

  // Analyst data
  if (data.analyst) {
    const a = data.analyst;
    const lines = ['=== ANALYST RECOMMENDATIONS ==='];
    if (a.recommendations?.length > 0) {
      const rec = a.recommendations[0];
      lines.push(`Current Month: StrongBuy=${rec.strongBuy} Buy=${rec.buy} Hold=${rec.hold} Sell=${rec.sell} StrongSell=${rec.strongSell}`);
    }
    if (a.numberOfAnalysts != null) lines.push(`Number of Analysts: ${a.numberOfAnalysts}`);
    lines.push(`Target Low: ${a.targetLow != null ? '$' + a.targetLow.toFixed(2) : 'N/A'}`);
    lines.push(`Target Mean: ${a.targetMean != null ? '$' + a.targetMean.toFixed(2) : 'N/A'}`);
    lines.push(`Target High: ${a.targetHigh != null ? '$' + a.targetHigh.toFixed(2) : 'N/A'}`);
    if (a.upgradeDowngradeHistory?.length > 0) {
      lines.push('Recent Upgrades/Downgrades:');
      for (const u of a.upgradeDowngradeHistory.slice(0, 5)) {
        lines.push(`  ${u.date}: ${u.firm} - ${u.action} ${u.fromGrade ? u.fromGrade + ' → ' : ''}${u.toGrade}`);
      }
    }
    sections.push(lines.join('\n'));
  }

  // Financial statements
  if (data.financials) {
    const f = data.financials;
    const lines = ['=== FINANCIAL STATEMENTS ==='];
    if (f.income) {
      lines.push(`Income Statement (${f.income.periods?.join(', ')}):`);
      for (const row of f.income.rows || []) {
        lines.push(`  ${row.label}: ${row.values.map((v: number | null) => formatNum(v)).join(' | ')}`);
      }
    }
    if (f.balance) {
      lines.push(`Balance Sheet (${f.balance.periods?.join(', ')}):`);
      for (const row of f.balance.rows || []) {
        lines.push(`  ${row.label}: ${row.values.map((v: number | null) => formatNum(v)).join(' | ')}`);
      }
    }
    if (f.cashflow) {
      lines.push(`Cash Flow (${f.cashflow.periods?.join(', ')}):`);
      for (const row of f.cashflow.rows || []) {
        lines.push(`  ${row.label}: ${row.values.map((v: number | null) => formatNum(v)).join(' | ')}`);
      }
    }
    sections.push(lines.join('\n'));
  }

  // News
  if (data.news?.length > 0) {
    const lines = ['=== LATEST NEWS ==='];
    for (const n of data.news) {
      lines.push(`- ${n.title} (${n.publisher})`);
    }
    sections.push(lines.join('\n'));
  }

  return sections.join('\n\n');
}

export async function POST(req: Request) {
  await ensureOllamaRunning();

  try {
    const formData = await req.formData();
    const messages = JSON.parse(formData.get('messages') as string);
    const model = (formData.get('model') as string) || 'gemma4:e4b';
    const ticker = (formData.get('ticker') as string) || '';
    const financialDataRaw = formData.get('financialData') as string;

    // Model installation check
    if (!(await checkModelInstalled(model))) {
      if (!(await installModel(model, (p) => console.log(p)))) {
        return Response.json({ error: `Model ${model} installation failed` }, { status: 500 });
      }
    }

    // Parse financial data sent from the frontend
    let financialContext = '';
    if (financialDataRaw) {
      try {
        const financialData = JSON.parse(financialDataRaw);
        financialContext = buildFinancialContext(financialData);
      } catch {
        financialContext = '';
      }
    }

    // Web search for latest info
    const lastMessage = messages[messages.length - 1];
    const userQuery = typeof lastMessage?.content === 'string' ? lastMessage.content : '';
    const searchQuery = ticker
      ? `${ticker} stock ${userQuery}`
      : userQuery;

    let webContext = '';
    try {
      const search = await runWebSearch(searchQuery);
      const lines: string[] = [];
      if (search.answer) lines.push(`Answer: ${search.answer}`);
      if (Array.isArray(search.results)) {
        lines.push('Sources:');
        for (const r of search.results) {
          lines.push(`- ${r.title || 'Result'}\n  ${r.url || ''}\n  ${r.content || r.snippet || ''}`);
        }
      }
      webContext = lines.join('\n');
    } catch (err) {
      webContext = `Web search failed: ${err instanceof Error ? err.message : 'Unknown error'}. Use the financial data provided below instead.`;
    }

    const systemPrompt = `You are an expert financial analysis assistant with Bloomberg Terminal-level knowledge. The user is analyzing ${ticker || '(no ticker selected)'}.

You have access to the following REAL-TIME financial data for this stock:

${financialContext || 'No financial data loaded yet. Ask the user to load a ticker.'}

${webContext ? `\n=== WEB SEARCH RESULTS ===\n${webContext}` : ''}

Guidelines:
- Use the financial data above as your PRIMARY source — it is real, current data from Yahoo Finance
- Reference specific numbers, ratios, and trends from the data when answering
- Cross-reference the web search results for the latest news and context
- Provide analysis like a Bloomberg Terminal analyst: concise, data-driven, actionable
- When discussing financials, reference specific line items and period-over-period trends
- Highlight important signals: earnings beats/misses, analyst consensus shifts, valuation metrics
- If asked about something not in the data, say so and suggest what the user could look into
- Format numbers clearly (e.g. $1.23T, $45.67B)`;

    // Normalize messages
    const processedMessages = messages.map((msg: any) => ({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content : String(msg.content || ''),
    }));

    const result = await streamText({
      model: ollama(model),
      messages: processedMessages,
      system: systemPrompt,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('[finance/chat] Error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
