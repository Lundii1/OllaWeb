import YahooFinance from 'yahoo-finance2';

const yahooFinance = new (YahooFinance as any)();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tickers = url.searchParams.get('tickers');
  const trending = url.searchParams.get('trending');

  // Fetch trending symbols
  if (trending === 'true') {
    try {
      const result = await yahooFinance.trendingSymbols('US', { count: 10 });
      const symbols = (result?.quotes || [])
        .map((q: any) => q.symbol)
        .filter((s: string) => s && /^[A-Z0-9.\-^]{1,10}$/.test(s));

      if (symbols.length === 0) {
        return Response.json({ items: [] });
      }

      // Fetch quotes for trending symbols
      const quotes = await Promise.all(
        symbols.map(async (s: string) => {
          try {
            return await yahooFinance.quote(s);
          } catch {
            return null;
          }
        })
      );

      const items = quotes
        .filter((q: any) => q && q.regularMarketPrice != null)
        .map((q: any) => ({
          symbol: q.symbol,
          name: q.shortName || q.longName || q.symbol,
          price: q.regularMarketPrice ?? 0,
          change: q.regularMarketChange ?? 0,
          changePercent: q.regularMarketChangePercent ?? 0,
          volume: q.regularMarketVolume ?? 0,
        }));

      return Response.json({ items });
    } catch (error) {
      console.error('[finance/watchlist] Trending error:', error);
      return Response.json({ items: [] });
    }
  }

  // Fetch quotes for specific tickers
  if (!tickers) {
    return Response.json({ error: 'Missing tickers parameter' }, { status: 400 });
  }

  const symbols = tickers
    .split(',')
    .map(t => t.trim().toUpperCase())
    .filter(t => /^[A-Z0-9.\-^]{1,10}$/.test(t));

  if (symbols.length === 0) {
    return Response.json({ error: 'No valid ticker symbols provided' }, { status: 400 });
  }

  try {
    const quotes = await Promise.all(
      symbols.map(async (s) => {
        try {
          return await yahooFinance.quote(s);
        } catch {
          return null;
        }
      })
    );

    const items = quotes
      .filter((q: any) => q && q.regularMarketPrice != null)
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.shortName || q.longName || q.symbol,
        price: q.regularMarketPrice ?? 0,
        change: q.regularMarketChange ?? 0,
        changePercent: q.regularMarketChangePercent ?? 0,
        volume: q.regularMarketVolume ?? 0,
      }));

    return Response.json({ items });
  } catch (error) {
    console.error('[finance/watchlist] Error:', error);
    return Response.json(
      { error: `Failed to fetch watchlist data: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
