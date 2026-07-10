import { streamText } from 'ai';
import {
  ollama,
  ensureOllamaRunning,
  checkModelInstalled,
  installModel,
  imageToBase64,
  runWebSearch,
  withRetry,
  classifyError,
} from '../../../lib/ollama-utils';
import type { CouncilEvent, ConfidenceLevel } from '../../../lib/types';

// ── Constants ──────────────────────────────────────────────────────

const MODEL_TIMEOUT_MS = 120_000;   // 2 min per model
const SYNTHESIS_TIMEOUT_MS = 90_000; // 1.5 min for synthesis
const MAX_INDIVIDUAL_CHARS = 8000;

const SYNTHESIS_SYSTEM_PROMPT = `You are synthesizing responses from multiple AI advisors into a single authoritative answer. Produce your response with these sections:

## Consensus
Where all advisors substantially agree, write the unified answer here. This is the main body and should read as a standalone, authoritative answer to the user's question.

## Points of Divergence
If advisors disagree on any points, describe each perspective fairly using phrases like "one perspective suggests..." or "another view holds...". If there are no meaningful disagreements, write "The advisors were in broad agreement."

## Confidence Assessment
Rate the overall agreement as exactly one of: STRONG CONSENSUS | MODERATE CONSENSUS | MIXED VIEWS | SIGNIFICANT DISAGREEMENT
Then add one sentence explaining why.

Rules:
- Start directly with the Consensus section. No preamble about being a moderator.
- Do NOT mention advisor names, model names, or "Advisor 1/2/3". Use generic phrasing only in the divergence section.
- The Consensus section should be comprehensive and more useful than any single response.
- Be concise. Do not repeat the same point from multiple angles.`;

// ── Helpers ────────────────────────────────────────────────────────

function truncateResponse(text: string): string {
  if (text.length <= MAX_INDIVIDUAL_CHARS) return text;
  return text.slice(0, MAX_INDIVIDUAL_CHARS) + '\n\n[Response truncated for synthesis]';
}

function extractConfidence(text: string): ConfidenceLevel {
  const lower = text.toLowerCase();
  if (lower.includes('strong consensus')) return 'strong';
  if (lower.includes('moderate consensus')) return 'moderate';
  if (lower.includes('mixed views')) return 'mixed';
  if (lower.includes('significant disagreement')) return 'disagreement';
  return 'unknown';
}

// ── Route Handler ──────────────────────────────────────────────────

export async function POST(req: Request) {
  await ensureOllamaRunning();

  try {
    const formData = await req.formData();
    const messages = JSON.parse(formData.get('messages') as string);
    const models: string[] = JSON.parse(formData.get('models') as string);
    const moderatorIndex = parseInt(formData.get('moderatorIndex') as string) || 0;
    const image = formData.get('image') as File | null;
    const enableDebate = formData.get('enableDebate') === 'true';

    if (!models || models.length !== 3) {
      return new Response(JSON.stringify({ error: 'Exactly 3 models required' }), { status: 400 });
    }

    // Ensure each model is available before streaming (warms up cloud models via checkModelInstalled)
    for (const model of models) {
      if (!await checkModelInstalled(model)) {
        if (!await installModel(model, (progress) => console.log(`Installing ${model}: ${progress}`))) {
          return new Response(JSON.stringify({ error: `Model ${model} installation failed` }), { status: 500 });
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
            content: `Web search results for: ${searchQuery}\n\n${lines.join('\n')}`,
          };
          last.content = last.content.replace(/^web:\s*/i, '');
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          webContextSystemMessage = {
            role: 'system',
            content: `Web search failed (${msg}). Proceed without external data.`,
          };
        }
      }
    }

    // Build processed messages
    const processedMessages = messages.map((msg: any, index: number) => {
      const isLatestUserMessage = index === messages.length - 1 && msg.role === 'user';
      const textContent = typeof msg.content === 'string'
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content.map((part: any) => typeof part === 'string' ? part : part.text || '').join('')
          : String(msg.content || '');
      return {
        role: msg.role,
        content: [
          { type: 'text', text: textContent },
          ...(isLatestUserMessage && imageContent ? [{ type: 'image', image: imageContent }] : [])
        ]
      };
    });

    const webSystemPrompt = webContextSystemMessage ? webContextSystemMessage.content : undefined;

    // Create the SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const emit = (event: CouncilEvent) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch {
            // Controller already closed
          }
        };

        try {
          // === Phase 0: Individual responses (parallel — cloud models run concurrently) ===
          const individualResults: string[] = ['', '', ''];

          await Promise.allSettled(
            models.map(async (model, index) => {
              emit({ event: 'individual_start', payload: { model, index } });

              let accumulatedText = '';

              try {
                await Promise.race([
                  withRetry(
                    async () => {
                      const result = await streamText({
                        model: ollama(model),
                        messages: processedMessages,
                        ...(webSystemPrompt ? { system: webSystemPrompt } : {}),
                      });

                      for await (const chunk of result.textStream) {
                        accumulatedText += chunk;
                        emit({
                          event: 'individual_chunk',
                          payload: { index, text: chunk },
                        });
                      }
                    },
                    { maxRetries: 1, delayMs: 3000, label: model }
                  ),
                  new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Model took too long to respond')), MODEL_TIMEOUT_MS)
                  ),
                ]);

                individualResults[index] = accumulatedText;
                emit({
                  event: 'individual_complete',
                  payload: { index, model, fullText: accumulatedText },
                });
              } catch (error) {
                const classified = classifyError(error instanceof Error ? error : new Error(String(error)));
                emit({
                  event: 'individual_error',
                  payload: { index, model, error: classified.message, action: classified.action },
                });
              }
            })
          );

          // Filter successful responses
          const successfulResponses = models
            .map((model, i) => ({ model, text: individualResults[i], index: i }))
            .filter(r => r.text.length > 0);

          if (successfulResponses.length === 0) {
            emit({ event: 'error', payload: { message: 'All models failed to respond', action: 'Check that Ollama is running and models are installed' } });
            return;
          }

          // === Phase 1: Optional Debate Round ===
          let debateClarifications = '';
          if (enableDebate && successfulResponses.length >= 2) {
            emit({ event: 'debate_start', payload: {} });

            const moderatorModel = models[moderatorIndex] || models[0];

            // Ask moderator to identify the biggest disagreement
            try {
              const disagreementCheck = await streamText({
                model: ollama(moderatorModel),
                messages: [
                  {
                    role: 'user' as const,
                    content: `Here are responses from multiple AI advisors to the same question:\n\n${
                      successfulResponses.map((r, i) => `--- Advisor ${i + 1} ---\n${truncateResponse(r.text)}`).join('\n\n')
                    }\n\nIdentify the single biggest point of disagreement between these advisors in 1-2 sentences. If they all substantially agree, reply with exactly: NONE`,
                  },
                ],
              });

              let disagreementText = '';
              for await (const chunk of disagreementCheck.textStream) {
                disagreementText += chunk;
                emit({ event: 'debate_chunk', payload: { text: chunk } });
              }

              // If there's a genuine disagreement, ask each model to clarify
              if (!disagreementText.trim().toUpperCase().includes('NONE') && disagreementText.trim().length > 10) {
                const clarifications: string[] = [];

                for (const resp of successfulResponses) {
                  try {
                    const clarification = await streamText({
                      model: ollama(resp.model),
                      messages: [
                        ...processedMessages,
                        { role: 'assistant' as const, content: resp.text },
                        {
                          role: 'user' as const,
                          content: `Another advisor disagrees with you on this point: "${disagreementText.trim()}"\n\nIn 2-3 sentences, clarify or defend your position on this specific point.`,
                        },
                      ],
                      maxTokens: 200,
                    });

                    let clarText = '';
                    for await (const chunk of clarification.textStream) {
                      clarText += chunk;
                    }
                    clarifications.push(`--- Advisor ${resp.index + 1} clarification ---\n${clarText}`);
                  } catch {
                    // Skip failed clarifications
                  }
                }

                if (clarifications.length > 0) {
                  debateClarifications = `\n\nAfter debate, advisors provided these clarifications:\n\n${clarifications.join('\n\n')}`;
                }
              }
            } catch {
              // Debate failed, continue without it
            }

            emit({ event: 'debate_complete', payload: {} });
          }

          // === Phase 2: Synthesis ===
          const moderatorModel = models[moderatorIndex] || models[0];
          emit({ event: 'synthesis_start', payload: { moderator: moderatorModel } });

          const userQuestion = last?.content || '';
          const advisorBlocks = successfulResponses
            .map((r, i) => `--- Advisor ${i + 1} ---\n${truncateResponse(r.text)}`)
            .join('\n\n');

          const synthesisUserPrompt =
            `Original question: "${userQuestion}"\n\nThe following advisors have responded independently:\n\n${advisorBlocks}${debateClarifications}\n\nSynthesize these into a single answer. Focus on answering the original question, not on describing what each advisor said.`;

          try {
            await Promise.race([
              (async () => {
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

                const confidence = extractConfidence(consensusText);
                emit({ event: 'synthesis_complete', payload: { fullText: consensusText, confidence } });
              })(),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Synthesis model took too long to respond')), SYNTHESIS_TIMEOUT_MS)
              ),
            ]);
          } catch (error) {
            const classified = classifyError(error instanceof Error ? error : new Error(String(error)));
            emit({
              event: 'error',
              payload: { message: `Synthesis failed: ${classified.message}`, action: classified.action },
            });
          }
        } catch (error) {
          const classified = classifyError(error instanceof Error ? error : new Error(String(error)));
          emit({ event: 'error', payload: { message: classified.message, action: classified.action } });
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
    const classified = classifyError(error instanceof Error ? error : new Error(String(error)));
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: classified.message,
        action: classified.action,
      }),
      { status: 500 }
    );
  }
}
