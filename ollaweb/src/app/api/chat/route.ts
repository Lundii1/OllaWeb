import { createOllama } from 'ollama-ai-provider';
import { streamText } from 'ai';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const ollama = createOllama();

let ollamaStarted = false;

async function ensureOllamaRunning() {
  if (!ollamaStarted) {
    console.log('Starting Ollama server...');
    exec('ollama serve');
    ollamaStarted = true;
  }
}

async function checkModelInstalled(modelName: string): Promise<boolean> {
  try {
    console.log(`Checking if model ${modelName} is installed...`);
    const { stdout } = await execAsync('ollama list');
    
    const lines = stdout.split('\n').slice(1);
    const fullModelName = modelName + ':latest';
    console.log('Installed models:', lines);
    
    const isInstalled = lines.some(line => 
      line.trim().startsWith(fullModelName)
    );
    
    console.log(`Model ${fullModelName} installed:`, isInstalled);
    return isInstalled;
  } catch (error) {
    console.error('Error checking model:', error);
    return false;
  }
}

async function installModel(model: string, onProgress: (progress: string) => void) {
  try {
    console.log(`Installing model ${model}...`);
    const child = exec(`ollama pull ${model}`);

    child.stdout?.on('data', (data) => {
      onProgress(data.toString());
    });

    child.stderr?.on('data', (data) => {
      console.error(`Error installing model ${model}:`, data.toString());
    });

    await new Promise((resolve, reject) => {
      child.on('close', (code) => {
        if (code === 0) {
          resolve(true);
        } else {
          reject(new Error(`Failed to install model ${model} with exit code ${code}`));
        }
      });
    });

    return true;
  } catch (error) {
    console.error(`Failed to install model ${model}:`, error);
    return false;
  }
}

export async function POST(req: Request) {
  await ensureOllamaRunning();
  try {
    let messages, model, image;
    if (req.headers.get('content-type')?.includes('multipart/form-data')) {
      const formData = await req.formData();
      messages = JSON.parse(formData.get('messages') as string);
      model = formData.get('model') as string || 'llama3.2';
      image = formData.get('image') as File;
    } else {
      const json = await req.json();
      messages = json.messages;
      model = json.model || 'llama3.2';
      image = null;
    }

    const selectedModel = model;

    const isInstalled = await checkModelInstalled(selectedModel);
    if (!isInstalled) {
      const installed = await new Promise<boolean>((resolve, reject) => {
        installModel(selectedModel, (progress) => {
          console.log(progress);
        }).then(resolve).catch(reject);
      });

      if (!installed) {
        return new Response(
          JSON.stringify({ error: `Failed to install model ${selectedModel}` }),
          { status: 500 }
        );
      }
    }

    const imageBase64 = image ? await imageToBase64(image) : null;

    const result = streamText({
      model: ollama(selectedModel),
      messages: messages.map((msg: any) => ({
        role: msg.role,
        content: [
          { type: 'text', text: msg.content },
          ...(imageBase64 ? [{ type: 'image', image: imageBase64 }] : []),
        ],
      })),
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500 }
    );
  }
}

async function imageToBase64(image: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(image);
  });
}

export async function GET(req: Request) {
  await ensureOllamaRunning();
  const url = new URL(req.url);
  if (url.pathname === '/api/check-model') {
    const modelParam = url.searchParams.get('model');
    if (!modelParam) {
      return new Response(JSON.stringify({ error: 'No model specified' }), { status: 400 });
    }
    const isInstalled = await checkModelInstalled(modelParam);
    return new Response(JSON.stringify({ installed: isInstalled }), { status: 200 });
  }
  return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 404 });
}