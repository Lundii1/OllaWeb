export interface ChatContentParts {
  visibleContent: string;
  reasoningContent: string;
  reasoningComplete: boolean;
}

export function splitChatContent(input: string): ChatContentParts {
  const normalized = (input ?? '')
    .replace(/《think》/gi, '<think>')
    .replace(/《\/think》/gi, '</think>');

  const reasoningBlocks: string[] = [];
  const visibleContent = normalized
    .replace(/<think>([\s\S]*?)(?:<\/think>|$)/gi, (_match, content: string) => {
      reasoningBlocks.push(content);
      return '';
    })
    .replace(/<\/?think>/gi, '')
    .trim();

  const lower = normalized.toLowerCase();
  const lastOpen = lower.lastIndexOf('<think>');
  const lastClose = lower.lastIndexOf('</think>');

  return {
    visibleContent,
    reasoningContent: reasoningBlocks.at(-1)?.trim() ?? '',
    reasoningComplete: lastOpen === -1 || lastClose > lastOpen,
  };
}
