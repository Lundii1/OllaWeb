import { streamText } from 'ai';
import { ollama, ensureOllamaRunning, classifyError } from '../../../../lib/ollama-utils';

export async function POST(req: Request) {
  try {
    await ensureOllamaRunning();

    const { latex, jobPosting, model } = await req.json();

    if (!latex || !jobPosting) {
      return Response.json({ error: 'Both latex and jobPosting are required' }, { status: 400 });
    }

    const selectedModel = model || 'llama3.2';

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          const result = await streamText({
            model: ollama(selectedModel),
            system: `You are a LaTeX resume tailoring expert. Given a LaTeX resume and a job posting, rewrite the resume LaTeX to better match the job requirements. Emphasize relevant skills and experience. Keep the LaTeX structure valid and compilable. Output ONLY the complete LaTeX document, no explanations or markdown code fences.`,
            messages: [
              {
                role: 'user' as const,
                content: `Here is my current LaTeX resume:\n\n${latex}\n\n---\n\nHere is the job posting I want to tailor it for:\n\n${jobPosting}\n\n---\n\nPlease rewrite the LaTeX resume to better match this job posting. Output only the complete LaTeX document.`,
              },
            ],
            abortSignal: AbortSignal.timeout(180_000),
          });

          for await (const chunk of result.textStream) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        } catch (error) {
          const classified = classifyError(error instanceof Error ? error : new Error(String(error)));
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: classified.message, action: classified.action })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: msg }, { status: 500 });
  }
}
