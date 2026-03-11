import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'data');
const JOB_PATH = path.join(DATA_DIR, 'extension-job.json');
const TTL_MS = 60 * 60 * 1000;

const corsHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
});

const isExpired = (createdAt?: string) => {
  if (!createdAt) return true;
  const ts = Date.parse(createdAt);
  if (Number.isNaN(ts)) return true;
  return Date.now() - ts > TTL_MS;
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const jobPosting = typeof body?.jobPosting === 'string' ? body.jobPosting.trim() : '';

    if (!jobPosting) {
      return Response.json(
        { error: 'jobPosting is required' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const payload = {
      jobPosting,
      sourceUrl: typeof body?.sourceUrl === 'string' ? body.sourceUrl : '',
      title: typeof body?.title === 'string' ? body.title : '',
      createdAt: new Date().toISOString(),
    };

    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(JOB_PATH, JSON.stringify(payload, null, 2));

    return Response.json({ success: true }, { headers: corsHeaders() });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: msg }, { status: 500, headers: corsHeaders() });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const consume = url.searchParams.get('consume') === '1';

    const raw = await readFile(JOB_PATH, 'utf-8');
    const data = JSON.parse(raw) as { jobPosting?: string; createdAt?: string };

    if (!data?.jobPosting || isExpired(data.createdAt)) {
      if (isExpired(data?.createdAt)) {
        try {
          await unlink(JOB_PATH);
        } catch {}
      }
      return Response.json(
        { error: 'No recent job posting found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    if (consume) {
      try {
        await unlink(JOB_PATH);
      } catch {}
    }

    return Response.json(data, { headers: corsHeaders() });
  } catch {
    return Response.json(
      { error: 'No recent job posting found' },
      { status: 404, headers: corsHeaders() }
    );
  }
}
