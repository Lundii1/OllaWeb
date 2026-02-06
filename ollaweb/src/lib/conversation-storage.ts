import type { Message, Conversation } from './types';

const STORAGE_KEY = 'ollaweb-conversations';
const COUNCIL_CONFIG_KEY = 'ollaweb-council-config';

export function listConversations(): Conversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const convos: Conversation[] = JSON.parse(raw);
    return convos.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function getConversation(id: string): Conversation | null {
  const convos = listConversations();
  return convos.find(c => c.id === id) ?? null;
}

export function saveConversation(conversation: Conversation): void {
  if (typeof window === 'undefined') return;
  try {
    const convos = listConversations();
    const idx = convos.findIndex(c => c.id === conversation.id);
    // Strip blob URLs from images before saving
    const cleaned: Conversation = {
      ...conversation,
      messages: conversation.messages.map(m => ({ ...m, image: undefined })),
    };
    if (idx >= 0) {
      convos[idx] = cleaned;
    } else {
      convos.unshift(cleaned);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convos));
  } catch (e) {
    console.error('Failed to save conversation:', e);
  }
}

export function deleteConversation(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const convos = listConversations();
    const filtered = convos.filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Failed to delete conversation:', e);
  }
}

// Council config persistence (auto-save current models + moderator)
export function getSavedCouncilConfig(): { models: [string, string, string]; moderatorIndex: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(COUNCIL_CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSavedCouncilConfig(config: { models: [string, string, string]; moderatorIndex: number }): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(COUNCIL_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save council config:', e);
  }
}

export function generateTitle(messages: Message[]): string {
  const firstUserMsg = messages.find(m => m.role === 'user');
  if (!firstUserMsg) return 'New Chat';
  const text = firstUserMsg.content.trim();
  if (text.length <= 50) return text;
  return text.slice(0, 50) + '...';
}
