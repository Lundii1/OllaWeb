import { createOllama } from 'ollama-ai-provider';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

export const execAsync = promisify(exec);
export const ollama = createOllama();

const OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
const OLLAMA_READY_TIMEOUT_MS = 30_000;
const OLLAMA_POLL_INTERVAL_MS = 500;

let ollamaStarted = false;

// ── Health Checks ──────────────────────────────────────────────────

export async function isOllamaReady(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function ensureOllamaRunning(): Promise<void> {
  // Already running?
  if (await isOllamaReady()) {
    ollamaStarted = true;
    return;
  }

  // Try to start it
  if (!ollamaStarted) {
    console.log('Starting Ollama server...');
    exec('ollama serve');
    ollamaStarted = true;
  }

  // Poll until ready or timeout
  const deadline = Date.now() + OLLAMA_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isOllamaReady()) return;
    await new Promise((r) => setTimeout(r, OLLAMA_POLL_INTERVAL_MS));
  }

  throw new Error(
    'Ollama server did not start within 30 seconds. Please start Ollama manually: run "ollama serve" in a terminal.'
  );
}

/**
 * Ping a model with a 1-token request to warm it into memory.
 * Returns true if the model responds, false otherwise.
 */
export async function pingModel(modelName: string): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        prompt: 'hi',
        stream: false,
        options: { num_predict: 1 },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Model Management ───────────────────────────────────────────────

export async function checkModelInstalled(modelName: string): Promise<boolean> {
  try {
    console.log(`Checking if model ${modelName} is installed...`);
    const { stdout } = await execAsync('ollama list');

    const lines = stdout.split('\n').slice(1);
    const fullModelName = modelName + ':latest';

    return lines.some(line => line.trim().startsWith(modelName) || line.trim().startsWith(fullModelName));
  } catch (error) {
    console.error('Error checking model:', error);
    return false;
  }
}

export async function installModel(model: string, onProgress: (progress: string) => void) {
  try {
    console.log(`Installing model ${model}...`);
    const child = exec(`ollama pull ${model}`);

    child.stdout?.on('data', (data) => onProgress(data.toString()));
    child.stderr?.on('data', (data) => console.error(`Error installing model:`, data.toString()));

    return await new Promise<boolean>((resolve, reject) => {
      child.on('close', (code) => code === 0 ? resolve(true) : reject(new Error(`Installation failed with code ${code}`)));
    });
  } catch (error) {
    console.error(`Failed to install model ${model}:`, error);
    return false;
  }
}

// ── Image Processing ───────────────────────────────────────────────

export async function imageToBase64(image: File): Promise<string> {
  try {
    const buffer = await image.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return `data:${image.type};base64,${base64}`;
  } catch (error) {
    console.error('Image conversion error:', error);
    throw new Error('Failed to process image');
  }
}

// ── Web Search ─────────────────────────────────────────────────────

export async function runWebSearch(query: string) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error('Missing TAVILY_API_KEY');
  }

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'basic',
      include_answer: true,
      max_results: 5
    })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Web search failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data as any;
}

// ── Retry Logic ────────────────────────────────────────────────────

interface RetryOptions {
  maxRetries: number;
  delayMs: number;
  label?: string;
}

function isTransientError(err: Error): boolean {
  const msg = err.message.toLowerCase();
  return (
    msg.includes('econnrefused') ||
    msg.includes('econnreset') ||
    msg.includes('503') ||
    msg.includes('overloaded') ||
    msg.includes('fetch failed') ||
    msg.includes('network')
  );
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (!isTransientError(lastError) || attempt === options.maxRetries) {
        throw lastError;
      }
      const delay = options.delayMs * (attempt + 1);
      console.log(
        `[Retry] ${options.label || 'operation'} failed (attempt ${attempt + 1}/${options.maxRetries + 1}), retrying in ${delay}ms...`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

// ── Error Classification ───────────────────────────────────────────

export function classifyError(error: Error): { message: string; action: string } {
  const msg = error.message.toLowerCase();

  if (msg.includes('econnrefused') || msg.includes('fetch failed'))
    return { message: 'Cannot connect to Ollama', action: 'Run "ollama serve" in a terminal' };

  if (msg.includes('not found') || msg.includes('no such model'))
    return { message: 'Model not found', action: 'Run "ollama pull <model>" to install it' };

  if (msg.includes('timed out') || msg.includes('timeout') || msg.includes('aborted'))
    return { message: 'Model took too long to respond', action: 'Try a smaller model or check GPU load' };

  if (msg.includes('out of memory') || msg.includes('oom') || msg.includes('alloc'))
    return { message: 'Out of GPU/RAM memory', action: 'Close other applications or use a smaller model' };

  if (msg.includes('503') || msg.includes('overloaded'))
    return { message: 'Ollama is overloaded', action: 'Wait a moment and try again' };

  return { message: `Error: ${error.message}`, action: 'Check Ollama logs for details' };
}
