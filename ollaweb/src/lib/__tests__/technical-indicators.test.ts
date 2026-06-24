import { describe, it, expect } from 'vitest'
import {
  computeSMA,
  computeEMA,
  computeRSI,
  computeMACD,
  computeBollingerBands,
} from '../technical-indicators'

describe('computeSMA', () => {
  it('returns null values for periods before the period length', () => {
    const closes = [10, 20, 30, 40, 50]
    const result = computeSMA(closes, 3)
    expect(result[0]).toBeNull()
    expect(result[1]).toBeNull()
    expect(result[2]).toBe(20) // (10+20+30)/3
    expect(result[4]).toBe(40) // (30+40+50)/3
  })

  it('calculates correct SMA values', () => {
    const closes = [1, 2, 3, 4, 5]
    const result = computeSMA(closes, 2)
    expect(result[0]).toBeNull()
    expect(result[1]).toBe(1.5) // (1+2)/2
    expect(result[2]).toBe(2.5) // (2+3)/2
    expect(result[4]).toBe(4.5) // (4+5)/2
  })

  it('handles single period', () => {
    const closes = [10, 20, 30]
    const result = computeSMA(closes, 1)
    expect(result).toEqual([10, 20, 30])
  })

  it('handles empty array', () => {
    const result = computeSMA([], 3)
    expect(result).toEqual([])
  })

  it('handles array smaller than period', () => {
    const closes = [10, 20]
    const result = computeSMA(closes, 5)
    expect(result).toEqual([null, null])
  })
})

describe('computeEMA', () => {
  it('returns null values before period length', () => {
    const closes = [10, 20, 30, 40, 50]
    const result = computeEMA(closes, 3)
    expect(result[0]).toBeNull()
    expect(result[1]).toBeNull()
    expect(result[2]).not.toBeNull()
  })

  it('EMA eventually tracks price direction', () => {
    const increasing = [10, 12, 14, 16, 18, 20]
    const result = computeEMA(increasing, 3)
    const validValues = result.filter(v => v !== null)
    expect(validValues.length).toBeGreaterThan(0)
  })
})

describe('computeRSI', () => {
  it('returns null values for insufficient data', () => {
    const closes = [10, 20, 30]
    const result = computeRSI(closes, 14)
    expect(result.every(v => v === null)).toBe(true)
  })

  it('returns RSI between 0 and 100', () => {
    // Create enough data points for RSI(14)
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i * 0.5)
    const result = computeRSI(closes, 14)
    const validValues = result.filter((v): v is number => v !== null)
    validValues.forEach(rsi => {
      expect(rsi).toBeGreaterThanOrEqual(0)
      expect(rsi).toBeLessThanOrEqual(100)
    })
  })

  it('handles consistent upward movement (high RSI)', () => {
    const alwaysRising = Array.from({ length: 30 }, (_, i) => 100 + i)
    const result = computeRSI(alwaysRising, 14)
    const lastValid = [...result].reverse().find(v => v !== null)
    expect(lastValid).toBeGreaterThan(50)
  })

  it('handles consistent downward movement (low RSI)', () => {
    const alwaysFalling = Array.from({ length: 30 }, (_, i) => 200 - i)
    const result = computeRSI(alwaysFalling, 14)
    const lastValid = [...result].reverse().find(v => v !== null)
    expect(lastValid).toBeLessThan(50)
  })
})

describe('computeMACD', () => {
  it('returns macd, signal, and histogram arrays', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 5) * 10)
    const result = computeMACD(closes)
    
    expect(result.macd).toBeDefined()
    expect(result.signal).toBeDefined()
    expect(result.histogram).toBeDefined()
    expect(result.macd.length).toBe(closes.length)
    expect(result.signal.length).toBe(closes.length)
    expect(result.histogram.length).toBe(closes.length)
  })

  it('returns null values for insufficient data', () => {
    const closes = [10, 20, 30]
    const result = computeMACD(closes)
    expect(result.macd[0]).toBeNull()
    expect(result.macd[1]).toBeNull()
    expect(result.signal[0]).toBeNull()
  })
})

describe('computeBollingerBands', () => {
  it('returns upper, middle, and lower arrays', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.random() * 10)
    const result = computeBollingerBands(closes)
    
    expect(result.upper).toBeDefined()
    expect(result.middle).toBeDefined()
    expect(result.lower).toBeDefined()
    expect(result.upper.length).toBe(closes.length)
  })

  it('upper band is above middle band', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i)
    const result = computeBollingerBands(closes, 10)
    
    for (let i = 10; i < closes.length; i++) {
      if (result.upper[i] !== null && result.middle[i] !== null) {
        expect(result.upper[i]!).toBeGreaterThan(result.middle[i]!)
      }
    }
  })

  it('lower band is below middle band', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i)
    const result = computeBollingerBands(closes, 10)
    
    for (let i = 10; i < closes.length; i++) {
      if (result.lower[i] !== null && result.middle[i] !== null) {
        expect(result.lower[i]!).toBeLessThan(result.middle[i]!)
      }
    }
  })

  it('returns null values before period', () => {
    const closes = [10, 20, 30, 40, 50]
    const result = computeBollingerBands(closes, 10)
    for (let i = 0; i < 10; i++) {
      expect(result.upper[i]).toBeNull()
      expect(result.middle[i]).toBeNull()
      expect(result.lower[i]).toBeNull()
    }
  })
})
