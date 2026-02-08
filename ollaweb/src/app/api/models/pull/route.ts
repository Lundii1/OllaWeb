import { ensureOllamaRunning } from '../../../../lib/ollama-utils';

const OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

export async function POST(req: Request) {
  try {
    await ensureOllamaRunning();

    const { model } = await req.json() as { model: string };

    if (!model) {
      return Response.json({ error: 'model name required' }, { status: 400 });
    }

    // Use Ollama's pull API with streaming
    const pullRes = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model, stream: true }),
    });

    if (!pullRes.ok || !pullRes.body) {
      return Response.json({ error: 'Failed to start model pull' }, { status: 502 });
    }

    // Stream the pull progress to the client
    const reader = pullRes.body.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const text = decoder.decode(value, { stream: true });
            // Ollama sends newline-delimited JSON
            const lines = text.split('\n').filter((l) => l.trim());

            for (const line of lines) {
              try {
                const data = JSON.parse(line);
                // Forward status and progress
                const event = {
                  status: data.status || '',
                  total: data.total || 0,
                  completed: data.completed || 0,
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
              } catch {}
            }
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Pull failed';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: msg }, { status: 500 });
  }
}
