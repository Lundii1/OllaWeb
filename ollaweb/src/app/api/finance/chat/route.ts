import { streamText } from 'ai';
import {
  ollama,
  ensureOllamaRunning,
  checkModelInstalled,
  installModel,
  runWebSearch,
} from '../../../../lib/ollama-utils';

export async function POST(req: Request) {
  await ensureOllamaRunning();

  try {
    const formData = await req.formData();
    const messages = JSON.parse(formData.get('messages') as string);
    const model = (formData.get('model') as string) || 'llama3.2';
    const ticker = (formData.get('ticker') as string) || '';

    // Model installation check
    if (!(await checkModelInstalled(model))) {
      if (!(await installModel(model, (p) => console.log(p)))) {
        return Response.json({ error: `Model ${model} installation failed` }, { status: 500 });
      }
    }

    // Always run web search — this is the core difference from /api/chat
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
      webContext = `Web search failed: ${err instanceof Error ? err.message : 'Unknown error'}. Proceed with your existing knowledge.`;
    }

    // Finance-specific system prompt with web results baked in
    const systemPrompt = `You are a financial analysis assistant. The user is viewing the stock ticker ${ticker || '(none selected)'}.

Use the following recent web search results to provide up-to-date information:

${webContext}

Guidelines:
- Provide current market conditions and recent news
- Reference key financial metrics and trends
- Mention analyst opinions when available
- Give clear, concise explanations
- Always cite sources when referencing specific data or news
- If the search results don't contain relevant info, say so honestly`;

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
