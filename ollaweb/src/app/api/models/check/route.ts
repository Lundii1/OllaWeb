import { ensureOllamaRunning } from '../../../../lib/ollama-utils';

const OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

export async function POST(req: Request) {
  try {
    await ensureOllamaRunning();

    const { models } = await req.json() as { models: string[] };

    if (!models || !Array.isArray(models)) {
      return Response.json({ error: 'models array required' }, { status: 400 });
    }

    // Get installed models from Ollama
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return Response.json({ error: 'Failed to reach Ollama' }, { status: 502 });
    }

    const data = await res.json() as { models: Array<{ name: string }> };
    const installedNames = data.models.map((m) => m.name);

    const results: Record<string, boolean> = {};
    for (const model of models) {
      // Check if any installed model matches:
      // - exact match (e.g. "gpt-oss:20b" === "gpt-oss:20b")
      // - requested without tag matches installed with :latest (e.g. "deepseek-ocr" matches "deepseek-ocr:latest")
      // - requested with :latest matches installed name (e.g. "deepseek-ocr:latest" matches "deepseek-ocr:latest")
      results[model] = installedNames.some((installed) => {
        if (installed === model) return true;
        // If model has no tag, match against name part
        if (!model.includes(':') && installed.startsWith(model + ':')) return true;
        // If model has :latest, also check without
        if (model.endsWith(':latest') && installed === model) return true;
        return false;
      });
    }

    return Response.json({ results });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: msg }, { status: 500 });
  }
}
