import { createOllama } from 'ollama-ai-provider';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

export const execAsync = promisify(exec);
export const ollama = createOllama();

let ollamaStarted = false;

export async function ensureOllamaRunning() {
  if (!ollamaStarted) {
    console.log('Starting Ollama server...');
    exec('ollama serve');
    ollamaStarted = true;
  }
}

export async function checkModelInstalled(modelName: string): Promise<boolean> {
  try {
    console.log(`Checking if model ${modelName} is installed...`);
    const { stdout } = await execAsync('ollama list');

    const lines = stdout.split('\n').slice(1);
    const fullModelName = modelName + ':latest';

    return lines.some(line => line.trim().startsWith(fullModelName));
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
