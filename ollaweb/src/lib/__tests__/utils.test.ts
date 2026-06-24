import { describe, it, expect } from 'vitest'
import { cn } from '../utils'

describe('cn (class name utility)', () => {
  it('merges class names', () => {
    const result = cn('foo', 'bar')
    expect(result).toContain('foo')
    expect(result).toContain('bar')
  })

  it('handles conditional classes', () => {
    const condition = true
    const result = cn('base', condition && 'conditional')
    expect(result).toContain('base')
    expect(result).toContain('conditional')
  })

  it('handles false conditions', () => {
    const result = cn('base', false && 'hidden')
    expect(result).toContain('base')
    expect(result).not.toContain('hidden')
  })

  it('handles empty inputs', () => {
    const result = cn()
    expect(result).toBe('')
  })
})
