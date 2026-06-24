import { describe, it, expect } from 'vitest'
import { classifyError } from '../ollama-utils'

describe('classifyError', () => {
  it('classifies connection refused errors', () => {
    const error = new Error('fetch failed: ECONNREFUSED')
    const result = classifyError(error)
    expect(result.message).toBe('Cannot connect to Ollama')
    expect(result.action).toContain('ollama serve')
  })

  it('classifies model not found errors', () => {
    const error = new Error('Model not found: llama3.2')
    const result = classifyError(error)
    expect(result.message).toBe('Model not found')
    expect(result.action).toContain('ollama pull')
  })

  it('classifies timeout errors', () => {
    const error = new Error('Request timed out after 120000ms')
    const result = classifyError(error)
    expect(result.message).toBe('Model took too long to respond')
  })

  it('classifies out of memory errors', () => {
    const error = new Error('CUDA out of memory')
    const result = classifyError(error)
    expect(result.message).toBe('Out of GPU/RAM memory')
  })

  it('classifies overloaded errors', () => {
    const error = new Error('Service unavailable: 503')
    const result = classifyError(error)
    expect(result.message).toBe('Ollama is overloaded')
  })

  it('returns generic message for unknown errors', () => {
    const error = new Error('Something went wrong')
    const result = classifyError(error)
    expect(result.message).toContain('Something went wrong')
    expect(result.action).toContain('Ollama logs')
  })

  it('handles case-insensitive matching', () => {
    const error = new Error('ECONNREFUSED')
    const result = classifyError(error)
    expect(result.message).toBe('Cannot connect to Ollama')
  })

  it('classifies transient network errors as actionable', () => {
    const errors = [
      'ECONNREFUSED',
      'ECONNRESET', 
      '503 Service Unavailable',
      'model is overloaded',
      'network error',
      'fetch failed'
    ]
    
    errors.forEach(msg => {
      const result = classifyError(new Error(msg))
      expect(result.message).not.toBe('Something went wrong')
    })
  })
})
