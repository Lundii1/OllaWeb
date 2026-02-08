import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { UserProfile } from '../../../lib/resume-types';
import { DEFAULT_PROFILE } from '../../../lib/resume-types';

const DATA_DIR = path.join(process.cwd(), 'data');
const PROFILE_PATH = path.join(DATA_DIR, 'profile.json');

export async function GET() {
  try {
    const raw = await readFile(PROFILE_PATH, 'utf-8');
    return Response.json(JSON.parse(raw));
  } catch {
    return Response.json(DEFAULT_PROFILE);
  }
}

export async function POST(req: Request) {
  try {
    const profile: UserProfile = await req.json();
    profile.lastModified = new Date().toISOString();

    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(PROFILE_PATH, JSON.stringify(profile, null, 2));

    return Response.json({ success: true, profile });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: msg }, { status: 500 });
  }
}
