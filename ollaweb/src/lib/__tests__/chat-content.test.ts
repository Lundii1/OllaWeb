import { describe, expect, it } from 'vitest';
import { splitChatContent } from '../chat-content';

describe('splitChatContent', () => {
  it('preserves Markdown while separating reasoning', () => {
    expect(splitChatContent('<think>private plan</think>\n# Heading\n\n- one\n- two')).toEqual({
      reasoningContent: 'private plan',
      reasoningComplete: true,
      visibleContent: '# Heading\n\n- one\n- two',
    });
  });

  it('separates an incomplete streaming reasoning block', () => {
    const result = splitChatContent('<think>still working');

    expect(result.reasoningContent).toBe('still working');
    expect(result.reasoningComplete).toBe(false);
    expect(result.visibleContent).toBe('');
  });
});
