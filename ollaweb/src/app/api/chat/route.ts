import { streamText } from 'ai';
import {
  ollama,
  ensureOllamaRunning,
  checkModelInstalled,
  installModel,
  imageToBase64,
  runWebSearch,
} from '../../../lib/ollama-utils';

export async function POST(req: Request) {
  await ensureOllamaRunning();

  // Handle installation-only requests
  if (req.headers.get('content-type')?.startsWith('application/json')) {
    try {
      const { model, installOnly } = await req.json();
      if (installOnly) {
        return new Response(
          new ReadableStream({
            async start(controller) {
              const installSuccess = await installModel(model, (progress) => {
                controller.enqueue(new TextEncoder().encode(progress + '\n'));
              });

              if (installSuccess) {
                controller.close();
              } else {
                controller.error('Installation failed');
              }
            }
          }),
          { status: 200 }
        );
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid installation request' }), { status: 400 });
    }
  }

  try {
    const formData = await req.formData();
    const messages = JSON.parse(formData.get('messages') as string);
    const model = formData.get('model') as string || 'llama3.2-vision';
    const image = formData.get('image') as File;

    // Model installation check
    if (!await checkModelInstalled(model)) {
      if (!await installModel(model, (progress) => console.log(progress))) {
        return new Response(JSON.stringify({ error: `Model ${model} installation failed` }), { status: 500 });
      }
    }

    // Process image only for the latest message
    const imageContent = image ? await imageToBase64(image) : null;

    // Detect optional web search command on the latest user message
    const last = messages[messages.length - 1];
    let webContextSystemMessage: any | null = null;
    if (last?.role === 'user' && typeof last.content === 'string') {
      const match = last.content.trim().match(/^web:\s*(.+)$/i);
      if (match && match[1]) {
        const searchQuery = match[1].trim();
        try {
          const search = await runWebSearch(searchQuery);
          const lines: string[] = [];
          if (search.answer) {
            lines.push(`Answer: ${search.answer}`);
          }
          if (Array.isArray(search.results)) {
            lines.push('Sources:');
            for (const r of search.results) {
              const title = r.title || 'Result';
              const url = r.url || '';
              const snippet = r.content || r.snippet || '';
              lines.push(`- ${title}\n  ${url}\n  ${snippet}`);
            }
          }
          webContextSystemMessage = {
            role: 'system',
            content: [
              { type: 'text', text: `Web search results for: ${searchQuery}\n\n${lines.join('\n')}` }
            ]
          };
          // Replace user content to remove the web: prefix for cleaner prompts
          last.content = last.content.replace(/^web:\s*/i, '');
        } catch (err) {
          // If search fails, inject a system note so the model can notify the user
          const msg = err instanceof Error ? err.message : 'Unknown error';
          webContextSystemMessage = {
            role: 'system',
            content: [
              { type: 'text', text: `Web search failed (${msg}). Proceed without external data.` }
            ]
          };
        }
      }
    }

    // Prepare messages with image only on the latest user message
    const processedMessages = messages.map((msg: any, index: number) => {
      const isLatestUserMessage = index === messages.length - 1 && msg.role === 'user';

      return {
        role: msg.role,
        content: [
          { type: 'text', text: msg.content },
          ...(isLatestUserMessage && imageContent ? [{ type: 'image', image: imageContent }] : [])
        ]
      };
    });

    // Prepend web context if available
    const finalMessages = webContextSystemMessage ? [webContextSystemMessage, ...processedMessages] : processedMessages;

    // Generate response
    const result = await streamText({
      model: ollama(model),
      messages: finalMessages
    });

    return result.toTextStreamResponse();

  } catch (error) {
    console.error('API Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  await ensureOllamaRunning();
  const url = new URL(req.url);

  if (url.pathname === '/api/check-model') {
    const model = url.searchParams.get('model');
    if (!model) return new Response(JSON.stringify({ error: 'Model parameter required' }), { status: 400 });

    return new Response(
      JSON.stringify({ installed: await checkModelInstalled(model) }),
      { status: 200 }
    );
  }

  return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 });
}
