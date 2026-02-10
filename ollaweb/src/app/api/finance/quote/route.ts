import YahooFinance from 'yahoo-finance2';

const yahooFinance = new (YahooFinance as any)();

const PERIOD_CONFIG: Record<string, { days: number; interval: string }> = {
  '1d':  { days: 1,    interval: '2m'  },
  '5d':  { days: 5,    interval: '15m' },
  '1mo': { days: 30,   interval: '1d'  },
  '3mo': { days: 90,   interval: '1d'  },
  '1y':  { days: 365,  interval: '1wk' },
  '5y':  { days: 1825, interval: '1mo' },
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticker = url.searchParams.get('ticker')?.toUpperCase().trim();
  const period = url.searchParams.get('period') || '1mo';

  if (!ticker || !/^[A-Z0-9.\-^]{1,10}$/.test(ticker)) {
    return Response.json({ error: 'Invalid ticker symbol' }, { status: 400 });
  }

  const config = PERIOD_CONFIG[period];
  if (!config) {
    return Response.json({ error: 'Invalid period. Use: 1d, 5d, 1mo, 3mo, 1y, 5y' }, { status: 400 });
  }

  try {
    const period1 = new Date();
    period1.setDate(period1.getDate() - config.days);
    const period2 = new Date();

    // Fetch chart data, quote, news, and detailed metrics in parallel
    // News and metrics failures don't block chart data
    const [chartResult, quoteResult]: [any, any] = await Promise.all([
      yahooFinance.chart(ticker, {
        period1: period1.toISOString().split('T')[0],
        period2: period2.toISOString().split('T')[0],
        interval: config.interval as any,
      }),
      yahooFinance.quote(ticker),
    ]);

    // Fetch news and detailed metrics separately (non-blocking)
    let news: any[] = [];
    let metrics: any = null;

    try {
      const searchResult = await yahooFinance.search(ticker, { newsCount: 8 });
      if (searchResult?.news && Array.isArray(searchResult.news)) {
        news = searchResult.news.map((n: any) => ({
          title: n.title || '',
          publisher: n.publisher || '',
          link: n.link || '',
          publishTime: n.providerPublishTime
            ? Math.floor(new Date(n.providerPublishTime).getTime() / 1000)
            : 0,
        }));
      }
    } catch (err) {
      console.warn('[finance/quote] News fetch failed:', err);
    }

    try {
      const summary = await yahooFinance.quoteSummary(ticker, {
        modules: ['summaryDetail', 'defaultKeyStatistics', 'financialData'],
      });
      const sd = summary?.summaryDetail || {};
      const ks = summary?.defaultKeyStatistics || {};
      const fd = summary?.financialData || {};

      metrics = {
        marketCap: sd.marketCap ?? null,
        peRatio: sd.trailingPE ?? null,
        forwardPE: sd.forwardPE ?? ks.forwardPE ?? null,
        beta: sd.beta ?? ks.beta ?? null,
        dividendYield: sd.dividendYield ?? null,
        fiftyTwoWeekHigh: sd.fiftyTwoWeekHigh ?? null,
        fiftyTwoWeekLow: sd.fiftyTwoWeekLow ?? null,
        avgVolume: sd.averageVolume ?? null,
        targetPrice: fd.targetMeanPrice ?? null,
        analystRating: fd.recommendationKey ?? null,
      };
    } catch (err) {
      console.warn('[finance/quote] Metrics fetch failed:', err);
    }

    if (!chartResult || !chartResult.quotes || chartResult.quotes.length === 0) {
      return Response.json({ error: `No data found for ticker "${ticker}"` }, { status: 404 });
    }

    // Transform chart data to our format
    const chartData = chartResult.quotes
      .filter((q: any) => q.date && q.close != null)
      .map((q: any) => ({
        time: Math.floor(new Date(q.date).getTime() / 1000),
        open: q.open ?? q.close,
        high: q.high ?? q.close,
        low: q.low ?? q.close,
        close: q.close,
        volume: q.volume ?? 0,
      }));

    const price = quoteResult.regularMarketPrice ?? chartData[chartData.length - 1]?.close ?? 0;
    const change = quoteResult.regularMarketChange ?? 0;
    const changePercent = quoteResult.regularMarketChangePercent ?? 0;

    return Response.json({
      symbol: ticker,
      name: quoteResult.shortName || quoteResult.longName || ticker,
      price,
      change,
      changePercent,
      currency: quoteResult.currency || 'USD',
      chartData,
      news,
      metrics,
    });
  } catch (error) {
    console.error('[finance/quote] Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (msg.includes('Not Found') || msg.includes('no data')) {
      return Response.json({ error: `Ticker "${ticker}" not found` }, { status: 404 });
    }
    return Response.json({ error: `Failed to fetch data: ${msg}` }, { status: 500 });
  }
}
