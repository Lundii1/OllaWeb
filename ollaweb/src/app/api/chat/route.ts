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
    
    return lines.some(line => line.trim().startsWith(fullModelName));
  } catch (error) {
    console.error('Error checking model:', error);
    return false;
  }
}

async function installModel(model: string, onProgress: (progress: string) => void) {
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

async function imageToBase64(image: File): Promise<string> {
  try {
    const buffer = await image.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return `data:${image.type};base64,${base64}`;
  } catch (error) {
    console.error('Image conversion error:', error);
    throw new Error('Failed to process image');
  }
}

export async function POST(req: Request) {
  await ensureOllamaRunning();

  // Handle installation-only requests
  if (req.headers.get('content-type')?.startsWith('application/json')) {
    try {
      const { model, installOnly } = await req.json();
      if (installOnly) {
        return new Response(
          new ReadableStream({
            async start(controller) {
              const installSuccess = await installModel(model, (progress) => {
                controller.enqueue(new TextEncoder().encode(progress + '\n'));
              });
              
              if (installSuccess) {
                controller.close();
              } else {
                controller.error('Installation failed');
              }
            }
          }),
          { status: 200 }
        );
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid installation request' }), { status: 400 });
    }
  }

  try {
    const formData = await req.formData();
    const messages = JSON.parse(formData.get('messages') as string);
    const model = formData.get('model') as string || 'llama3.2-vision';
    const image = formData.get('image') as File;

    // Model installation check
    if (!await checkModelInstalled(model)) {
      if (!await installModel(model, (progress) => console.log(progress))) {
        return new Response(JSON.stringify({ error: `Model ${model} installation failed` }), { status: 500 });
      }
    }

    // Process image only for the latest message
    const imageContent = image ? await imageToBase64(image) : null;

    // Prepare messages with image only on the latest user message
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

    // Generate response
    const result = await streamText({
      model: ollama(model),
      messages: processedMessages
    });

    return result.toTextStreamResponse();

  } catch (error) {
    console.error('API Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  await ensureOllamaRunning();
  const url = new URL(req.url);
  
  if (url.pathname === '/api/check-model') {
    const model = url.searchParams.get('model');
    if (!model) return new Response(JSON.stringify({ error: 'Model parameter required' }), { status: 400 });
    
    return new Response(
      JSON.stringify({ installed: await checkModelInstalled(model) }),
      { status: 200 }
    );
  }
  
  return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 });
}