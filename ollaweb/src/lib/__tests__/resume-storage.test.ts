import { describe, it, expect } from 'vitest'
import { generateVersionTitle } from '../resume-storage'

describe('generateVersionTitle', () => {
  it('includes "Saved" for Saved source', () => {
    const title = generateVersionTitle('Saved')
    expect(title).toContain('Saved')
  })

  it('includes "Tailored" for Tailored source', () => {
    const title = generateVersionTitle('Tailored')
    expect(title).toContain('Tailored')
  })

  it('contains a date and time', () => {
    const savedTitle = generateVersionTitle('Saved')
    const tailoredTitle = generateVersionTitle('Tailored')

    // Should contain a dash separator
    expect(savedTitle).toContain('—')
    expect(tailoredTitle).toContain('—')
  })
})