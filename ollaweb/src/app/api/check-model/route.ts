
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

async function checkModelInstalled(modelName: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync('ollama list');
    return stdout.includes(modelName + ':latest');
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const modelParam = url.searchParams.get('model');
  if (!modelParam) {
    return new Response(JSON.stringify({ error: 'No model specified' }), { status: 400 });
  }
  const isInstalled = await checkModelInstalled(modelParam);
  return new Response(JSON.stringify({ installed: isInstalled }), { status: 200 });
}