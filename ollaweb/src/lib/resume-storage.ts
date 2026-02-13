import type { ResumeVersion } from './resume-types';

const STORAGE_KEY = 'ollaweb-resume-versions';

export function listVersions(): ResumeVersion[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const versions: ResumeVersion[] = JSON.parse(raw);
    return versions.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export function getVersion(id: string): ResumeVersion | null {
  const versions = listVersions();
  return versions.find(v => v.id === id) ?? null;
}

export function saveVersion(version: ResumeVersion): void {
  if (typeof window === 'undefined') return;
  try {
    const versions = listVersions();
    const idx = versions.findIndex(v => v.id === version.id);
    if (idx >= 0) {
      versions[idx] = version;
    } else {
      versions.unshift(version);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(versions));
  } catch (e) {
    console.error('Failed to save resume version:', e);
  }
}

export function deleteVersion(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const versions = listVersions();
    const filtered = versions.filter(v => v.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Failed to delete resume version:', e);
  }
}

export function generateVersionTitle(source: 'Saved' | 'Tailored'): string {
  const now = new Date();
  const date = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${source} — ${date} ${time}`;
}
