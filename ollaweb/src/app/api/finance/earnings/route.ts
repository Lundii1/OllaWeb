import YahooFinance from 'yahoo-finance2';

const yahooFinance = new (YahooFinance as any)();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticker = url.searchParams.get('ticker')?.toUpperCase().trim();

  if (!ticker || !/^[A-Z0-9.\-^]{1,10}$/.test(ticker)) {
    return Response.json({ error: 'Invalid ticker symbol' }, { status: 400 });
  }

  try {
    const summary = await yahooFinance.quoteSummary(ticker, {
      modules: ['calendarEvents', 'earnings', 'earningsHistory', 'earningsTrend'],
    });

    // Next earnings date
    let nextEarningsDate: string | null = null;
    const calEvents = summary?.calendarEvents;
    if (calEvents?.earnings?.earningsDate && calEvents.earnings.earningsDate.length > 0) {
      nextEarningsDate = new Date(calEvents.earnings.earningsDate[0]).toISOString().split('T')[0];
    }

    // EPS history (actual vs estimate)
    const history = (summary?.earningsHistory?.history || []).map((h: any) => ({
      quarter: h.quarter ? `Q${h.quarter}` : '',
      date: h.period || '',
      epsEstimate: h.epsEstimate ?? null,
      epsActual: h.epsActual ?? null,
      surprise: h.epsDifference ?? null,
      surprisePercent: h.surprisePercent != null ? h.surprisePercent * 100 : null,
    }));

    // Forward estimates
    const trend = (summary?.earningsTrend?.trend || []).map((t: any) => ({
      period: t.period || '',
      endDate: t.endDate ? new Date(t.endDate).toISOString().split('T')[0] : null,
      epsEstimate: t.earningsEstimate?.avg ?? null,
      revenueEstimate: t.revenueEstimate?.avg ?? null,
      growth: t.growth?.raw != null ? t.growth.raw * 100 : (t.growth != null ? t.growth * 100 : null),
    }));

    // EPS revisions
    const epsRevisions = (summary?.earningsTrend?.trend || []).map((t: any) => ({
      period: t.period || '',
      upLast7: t.epsRevisions?.upLast7days ?? null,
      upLast30: t.epsRevisions?.upLast30days ?? null,
      downLast7: t.epsRevisions?.downLast7days ?? null,
      downLast30: t.epsRevisions?.downLast30days ?? null,
    }));

    return Response.json({
      nextEarningsDate,
      history,
      trend,
      epsRevisions,
    });
  } catch (error) {
    console.error('[finance/earnings] Error:', error);
    return Response.json(
      { error: `Failed to fetch earnings data: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
