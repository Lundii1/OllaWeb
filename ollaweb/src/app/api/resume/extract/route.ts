import { streamText } from 'ai';
import { ollama, ensureOllamaRunning, classifyError } from '../../../../lib/ollama-utils';

export async function POST(req: Request) {
  try {
    await ensureOllamaRunning();

    const formData = await req.formData();
    const file = formData.get('pdf') as File | null;
    const model = (formData.get('model') as string) || 'gemma4:e4b';

    if (!file) {
      return Response.json({ error: 'No PDF file provided' }, { status: 400 });
    }

    // Extract text from PDF using pdf-parse v1
    const buffer = Buffer.from(await file.arrayBuffer());
    // Import from internal lib to bypass pdf-parse's debug mode check
    // (index.js has `!module.parent` which triggers test code in Next.js)
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
    const pdfData = await pdfParse(buffer);
    const resumeText = pdfData.text;

    if (!resumeText.trim()) {
      return Response.json({ error: 'Could not extract text from PDF. The file may be image-based.' }, { status: 400 });
    }

    // Stream LaTeX conversion via Ollama
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          const result = await streamText({
            model: ollama(model),
            system: `You are a LaTeX resume expert. Convert the provided resume text into a clean, well-structured LaTeX document. Use the article document class. Include appropriate packages (geometry, enumitem, hyperref, etc). Preserve ALL information from the original resume. Output ONLY the LaTeX code, no explanations.`,
            messages: [
              {
                role: 'user' as const,
                content: `Convert this resume to LaTeX:\n\n${resumeText}`,
              },
            ],
            abortSignal: AbortSignal.timeout(180_000),
          });

          for await (const chunk of result.textStream) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        } catch (error) {
          console.error('[extract] Stream error:', error);
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
