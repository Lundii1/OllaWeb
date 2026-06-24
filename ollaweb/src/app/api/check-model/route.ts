import { checkModelInstalled } from '../../../lib/ollama-utils';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const modelParam = url.searchParams.get('model');
  if (!modelParam) {
    return new Response(JSON.stringify({ error: 'No model specified' }), { status: 400 });
  }
  const isInstalled = await checkModelInstalled(modelParam);
  return new Response(JSON.stringify({ installed: isInstalled }), { status: 200 });
}
