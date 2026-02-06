import { streamText } from 'ai';
import {
  ollama,
  ensureOllamaRunning,
  checkModelInstalled,
  installModel,
  imageToBase64,
  runWebSearch,
} from '../../../lib/ollama-utils';
import type { CouncilEvent } from '../../../lib/types';

const SYNTHESIS_SYSTEM_PROMPT =
  `You are a council moderator. You have been presented with responses from multiple AI advisors to the same question. Your task is to:

1. Identify the key points and insights from each response.
2. Note where the advisors agree and where they differ.
3. Synthesize a single, unified answer that represents the best consensus view.
4. If there are genuine disagreements, acknowledge them and explain the different perspectives.
5. Do not attribute responses to specific model names — refer to them as "Advisor 1", "Advisor 2", etc.
6. Your final answer should be comprehensive, balanced, and more useful than any single response alone.
7. Format your response clearly. Start directly with the consensus answer — do not begin with preamble about being a moderator.`;

const MAX_INDIVIDUAL_CHARS = 8000;

function truncateResponse(text: string): string {
  if (text.length <= MAX_INDIVIDUAL_CHARS) return text;
  return text.slice(0, MAX_INDIVIDUAL_CHARS) + '\n\n[Response truncated for synthesis]';
}

export async function POST(req: Request) {
  await ensureOllamaRunning();

  try {
    const formData = await req.formData();
    const messages = JSON.parse(formData.get('messages') as string);
    const models: string[] = JSON.parse(formData.get('models') as string);
    const moderatorIndex = parseInt(formData.get('moderatorIndex') as string) || 0;
    const image = formData.get('image') as File | null;

    if (!models || models.length !== 3) {
      return new Response(JSON.stringify({ error: 'Exactly 3 models required' }), { status: 400 });
    }

    // Check all models are installed
    for (const model of models) {
      if (!await checkModelInstalled(model)) {
        if (!await installModel(model, (progress) => console.log(progress))) {
          return new Response(
            JSON.stringify({ error: `Model ${model} installation failed` }),
            { status: 500 }
          );
        }
      }
    }

    // Process image if present
    const imageContent = image ? await imageToBase64(image) : null;

    // Handle web search on latest user message
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
          last.content = last.content.replace(/^web:\s*/i, '');
        } catch (err) {
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

    // Build processed messages
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

    const finalMessages = webContextSystemMessage
      ? [webContextSystemMessage, ...processedMessages]
      : processedMessages;

    // Create the SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const emit = (event: CouncilEvent) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };

        try {
          // === Phase 1: Individual responses ===
          const individualResults: string[] = ['', '', ''];

          const promises = models.map(async (model, index) => {
            emit({ event: 'individual_start', payload: { model, index } });

            try {
              const result = await streamText({
                model: ollama(model),
                messages: finalMessages,
              });

              for await (const chunk of result.textStream) {
                individualResults[index] += chunk;
                emit({
                  event: 'individual_chunk',
                  payload: { index, text: chunk },
                });
              }

              emit({
                event: 'individual_complete',
                payload: { index, model, fullText: individualResults[index] },
              });
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : 'Unknown error';
              emit({
                event: 'individual_error',
                payload: { index, model, error: errorMsg },
              });
            }
          });

          await Promise.allSettled(promises);

          // Filter successful responses
          const successfulResponses = models
            .map((model, i) => ({ model, text: individualResults[i], index: i }))
            .filter(r => r.text.length > 0);

          if (successfulResponses.length === 0) {
            emit({ event: 'error', payload: { message: 'All models failed to respond' } });
            controller.close();
            return;
          }

          // === Phase 2: Synthesis ===
          const moderatorModel = models[moderatorIndex] || models[0];
          emit({ event: 'synthesis_start', payload: { moderator: moderatorModel } });

          const userQuestion = last?.content || '';
          const advisorBlocks = successfulResponses
            .map((r, i) => `--- Advisor ${i + 1} ---\n${truncateResponse(r.text)}`)
            .join('\n\n');

          const synthesisUserPrompt =
            `The user asked: "${userQuestion}"\n\n${advisorBlocks}\n\nPlease synthesize these into a single consensus answer.`;

          try {
            const synthesisResult = await streamText({
              model: ollama(moderatorModel),
              messages: [
                {
                  role: 'system' as const,
                  content: SYNTHESIS_SYSTEM_PROMPT,
                },
                {
                  role: 'user' as const,
                  content: synthesisUserPrompt,
                },
              ],
            });

            let consensusText = '';
            for await (const chunk of synthesisResult.textStream) {
              consensusText += chunk;
              emit({ event: 'synthesis_chunk', payload: { text: chunk } });
            }

            emit({ event: 'synthesis_complete', payload: { fullText: consensusText } });
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            emit({
              event: 'error',
              payload: { message: `Synthesis failed: ${errorMsg}` },
            });
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          emit({ event: 'error', payload: { message: errorMsg } });
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
    console.error('Council API Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500 }
    );
  }
}
