import YahooFinance from 'yahoo-finance2';

const yahooFinance = new (YahooFinance as any)();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticker = url.searchParams.get('ticker')?.toUpperCase().trim();

  if (!ticker || !/^[A-Z0-9.\-^]{1,10}$/.test(ticker)) {
    return Response.json({ error: 'Invalid ticker symbol' }, { status: 400 });
  }

  try {
    // Fetch recommendation data and financial targets
    const [summary, insights] = await Promise.all([
      yahooFinance.quoteSummary(ticker, {
        modules: ['recommendationTrend', 'upgradeDowngradeHistory', 'financialData'],
      }).catch(() => null),
      yahooFinance.insights(ticker).catch(() => null),
    ]);

    // Recommendation trend (monthly breakdown)
    const recommendations = (summary?.recommendationTrend?.trend || []).map((t: any) => ({
      strongBuy: t.strongBuy ?? 0,
      buy: t.buy ?? 0,
      hold: t.hold ?? 0,
      sell: t.sell ?? 0,
      strongSell: t.strongSell ?? 0,
      period: t.period || '',
    }));

    // Upgrade/downgrade history
    const upgradeDowngradeHistory = (summary?.upgradeDowngradeHistory?.history || [])
      .slice(0, 15)
      .map((h: any) => ({
        firm: h.firm || '',
        toGrade: h.toGrade || '',
        fromGrade: h.fromGrade || '',
        action: h.action || '',
        date: h.epochGradeDate
          ? new Date(h.epochGradeDate * 1000).toISOString().split('T')[0]
          : '',
      }));

    // Price targets from financialData
    const fd = summary?.financialData || {};
    const targetLow = fd.targetLowPrice ?? null;
    const targetMean = fd.targetMeanPrice ?? null;
    const targetHigh = fd.targetHighPrice ?? null;
    const targetMedian = fd.targetMedianPrice ?? null;
    const currentPrice = fd.currentPrice ?? null;
    const numberOfAnalysts = fd.numberOfAnalystOpinions ?? null;

    return Response.json({
      recommendations,
      upgradeDowngradeHistory,
      targetLow,
      targetMean,
      targetHigh,
      targetMedian,
      currentPrice,
      numberOfAnalysts,
    });
  } catch (error) {
    console.error('[finance/analysis] Error:', error);
    return Response.json(
      { error: `Failed to fetch analyst data: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
