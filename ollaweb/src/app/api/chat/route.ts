import { createOllama } from 'ollama-ai-provider';
import { streamText } from 'ai';

export const runtime = 'edge';

// Create an instance of the Ollama provider
const ollama = createOllama();

export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = streamText({
    model: ollama('llama3.2'),
    messages,
  });

  return result.toDataStreamResponse();
}


