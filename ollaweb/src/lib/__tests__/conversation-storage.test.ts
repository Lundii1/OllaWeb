import { describe, it, expect, beforeEach, vi } from 'vitest'
import { generateTitle } from '../conversation-storage'
import type { Message } from '../types'

describe('generateTitle', () => {
  it('returns "New Chat" when no user messages exist', () => {
    const messages: Message[] = [
      { id: '1', role: 'assistant', content: 'Hello' }
    ]
    expect(generateTitle(messages)).toBe('New Chat')
  })

  it('returns empty array message content as "New Chat"', () => {
    expect(generateTitle([])).toBe('New Chat')
  })

  it('returns short user message as-is', () => {
    const messages: Message[] = [
      { id: '1', role: 'user', content: 'Hello, how are you?' }
    ]
    expect(generateTitle(messages)).toBe('Hello, how are you?')
  })

  it('truncates long messages to 50 characters', () => {
    const longMessage = 'This is a very long message that exceeds fifty characters and should be truncated'
    const messages: Message[] = [
      { id: '1', role: 'user', content: longMessage }
    ]
    const result = generateTitle(messages)
    expect(result.length).toBe(53) // 50 + '...'
    expect(result.endsWith('...')).toBe(true)
  })

  it('uses the first user message', () => {
    const messages: Message[] = [
      { id: '1', role: 'assistant', content: 'Hello' },
      { id: '2', role: 'user', content: 'First user message' },
      { id: '3', role: 'assistant', content: 'Response' },
      { id: '4', role: 'user', content: 'Second user message' }
    ]
    expect(generateTitle(messages)).toBe('First user message')
  })

  it('trims whitespace from message content', () => {
    const messages: Message[] = [
      { id: '1', role: 'user', content: '   Hello world   ' }
    ]
    expect(generateTitle(messages)).toBe('Hello world')
  })
})
