import { streamText } from 'ai';
import {
  ollama,
  ensureOllamaRunning,
  checkModelInstalled,
  installModel,
  runWebSearch,
  pingModel,
  withRetry,
  classifyError,
} from '../../../../lib/ollama-utils';
import { DEFAULT_COUNCIL_MODELS } from '../../../../lib/types';
import type { ConfidenceLevel } from '../../../../lib/types';

// ── Constants ──────────────────────────────────────────────────────

const MODEL_TIMEOUT_MS = 120_000;
const SYNTHESIS_TIMEOUT_MS = 90_000;
const MAX_INDIVIDUAL_CHARS = 8000;
const MODERATOR_INDEX = 0;

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
  // Parse and validate request body
  let body: { message?: string; messages?: Array<{ role: string; content: string }> };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Normalize to messages array
  let messages: Array<{ role: string; content: string }>;

  if (body.message && typeof body.message === 'string') {
    messages = [{ role: 'user', content: body.message }];
  } else if (body.messages && Array.isArray(body.messages) && body.messages.length > 0) {
    messages = body.messages;
  } else {
    return Response.json(
      { error: 'Request must include "message" (string) or "messages" (array)' },
      { status: 400 }
    );
  }

  // Handle web search on latest user message
  const last = messages[messages.length - 1];
  let webContextSystemMessage: { role: string; content: string } | null = null;
  let webSearchMeta: { query: string; results_count: number } | null = null;

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
          webSearchMeta = { query: searchQuery, results_count: search.results.length };
        } else {
          webSearchMeta = { query: searchQuery, results_count: 0 };
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
        webSearchMeta = { query: searchQuery, results_count: 0 };
      }
    }
  }

  // Ensure Ollama is running
  try {
    await ensureOllamaRunning();
  } catch (error) {
    const classified = classifyError(error instanceof Error ? error : new Error(String(error)));
    return Response.json({ error: classified.message, action: classified.action }, { status: 503 });
  }

  const models = [...DEFAULT_COUNCIL_MODELS];

  // Check and install all 3 default models
  for (const model of models) {
    if (!await checkModelInstalled(model)) {
      if (!await installModel(model, (progress) => console.log(`Installing ${model}: ${progress}`))) {
        return Response.json(
          { error: `Model ${model} installation failed` },
          { status: 500 }
        );
      }
    }
  }

  // Warm up models
  for (const model of models) {
    await pingModel(model);
  }

  // Build processed messages for the AI SDK
  const processedMessages = messages.map((msg) => ({
    role: msg.role as 'user' | 'assistant' | 'system',
    content: msg.content,
  }));

  const webSystemPrompt = webContextSystemMessage ? webContextSystemMessage.content : undefined;

  try {
    // Phase 1: Query all 3 models in parallel with timeouts and retries
    const individualPromises = models.map(async (model) => {
      const modelAbort = new AbortController();
      const timeoutId = setTimeout(() => modelAbort.abort(), MODEL_TIMEOUT_MS);

      try {
        let fullText = '';
        await withRetry(
          async () => {
            const result = await streamText({
              model: ollama(model),
              messages: processedMessages,
              abortSignal: modelAbort.signal,
              ...(webSystemPrompt ? { system: webSystemPrompt } : {}),
            });

            for await (const chunk of result.textStream) {
              fullText += chunk;
            }
          },
          { maxRetries: 1, delayMs: 3000, label: model }
        );

        clearTimeout(timeoutId);
        return { model, response: fullText };
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    });

    const settled = await Promise.allSettled(individualPromises);

    const advisors = settled.map((result, index) => {
      if (result.status === 'fulfilled') {
        return {
          model: models[index],
          response: result.value.response,
          ...(index === MODERATOR_INDEX ? { role: 'moderator' as const } : {}),
        };
      }
      const classified = classifyError(
        result.reason instanceof Error ? result.reason : new Error(String(result.reason))
      );
      return {
        model: models[index],
        response: null as string | null,
        error: classified.message,
        action: classified.action,
      };
    });

    const successfulAdvisors = advisors.filter((a) => a.response !== null);

    if (successfulAdvisors.length === 0) {
      return Response.json(
        { error: 'All models failed to respond', advisors },
        { status: 500 }
      );
    }

    // Phase 2: Synthesis by moderator with timeout
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    const userQuestion = lastUserMessage?.content || '';

    const advisorBlocks = successfulAdvisors
      .map((a, i) => `--- Advisor ${i + 1} ---\n${truncateResponse(a.response!)}`)
      .join('\n\n');

    const synthesisUserPrompt =
      `Original question: "${userQuestion}"\n\nThe following advisors have responded independently:\n\n${advisorBlocks}\n\nSynthesize these into a single answer. Focus on answering the original question, not on describing what each advisor said.`;

    const moderatorModel = models[MODERATOR_INDEX];
    const synthesisAbort = new AbortController();
    const synthesisTimeout = setTimeout(() => synthesisAbort.abort(), SYNTHESIS_TIMEOUT_MS);

    const synthesisResult = await streamText({
      model: ollama(moderatorModel),
      messages: [
        { role: 'system' as const, content: SYNTHESIS_SYSTEM_PROMPT },
        { role: 'user' as const, content: synthesisUserPrompt },
      ],
      abortSignal: synthesisAbort.signal,
    });

    let consensus = '';
    for await (const chunk of synthesisResult.textStream) {
      consensus += chunk;
    }

    clearTimeout(synthesisTimeout);

    const confidence = extractConfidence(consensus);

    return Response.json({
      consensus,
      confidence,
      advisors,
      models_used: models,
      moderator: moderatorModel,
      web_search: webSearchMeta,
    });
  } catch (error) {
    const classified = classifyError(error instanceof Error ? error : new Error(String(error)));
    return Response.json(
      { error: 'Council processing failed', message: classified.message, action: classified.action },
      { status: 500 }
    );
  }
}
