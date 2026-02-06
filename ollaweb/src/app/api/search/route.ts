export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  if (!q) {
    return new Response(JSON.stringify({ error: 'Missing q parameter' }), { status: 400 });
  }

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Missing TAVILY_API_KEY' }), { status: 500 });
  }

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: q,
        search_depth: 'basic',
        include_answer: true,
        max_results: 5
      })
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return new Response(JSON.stringify({ error: `Web search failed: ${res.status} ${text}` }), { status: 502 });
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { q } = await req.json();
    if (!q) {
      return new Response(JSON.stringify({ error: 'Missing q in body' }), { status: 400 });
    }
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing TAVILY_API_KEY' }), { status: 500 });
    }
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: q,
        search_depth: 'basic',
        include_answer: true,
        max_results: 5
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return new Response(JSON.stringify({ error: `Web search failed: ${res.status} ${text}` }), { status: 502 });
    }
    const data = await res.json();
    return new Response(JSON.stringify(data), { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}


