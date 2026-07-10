import { describe, expect, it } from 'vitest';
import {
  calculateRangePosition,
  formatCurrency,
  parseFinanceShareParams,
  validateComparisonSymbol,
} from '../finance-utils';

describe('parseFinanceShareParams', () => {
  it('normalizes the ticker and preserves a supported period and prompt', () => {
    const params = new URLSearchParams({
      sym: ' brk.b ',
      p: '5y',
      q: '  Compare margins  ',
    });

    expect(parseFinanceShareParams(params)).toEqual({
      ticker: 'BRK.B',
      period: '5y',
      prompt: 'Compare margins',
    });
  });

  it.each(['1d', '5d', '1mo', '3mo', '1y', '5y'])('accepts the %s period', (period) => {
    expect(parseFinanceShareParams(new URLSearchParams({ sym: 'AAPL', p: period })))
      .toMatchObject({ period });
  });

  it('uses the current one-month default for missing or unsupported periods', () => {
    expect(parseFinanceShareParams(new URLSearchParams({ sym: 'AAPL' })))
      .toMatchObject({ period: '1mo' });
    expect(parseFinanceShareParams(new URLSearchParams({ sym: 'AAPL', p: 'max' })))
      .toMatchObject({ period: '1mo' });
  });

  it('truncates a trimmed shared prompt to 500 characters', () => {
    const prompt = `  ${'x'.repeat(501)}  `;
    const parsed = parseFinanceShareParams(new URLSearchParams({ sym: 'AAPL', q: prompt }));

    expect(parsed?.prompt).toBe('x'.repeat(500));
  });

  it('represents a missing or whitespace-only prompt as null', () => {
    expect(parseFinanceShareParams(new URLSearchParams({ sym: 'AAPL' }))?.prompt).toBeNull();
    expect(parseFinanceShareParams(new URLSearchParams({ sym: 'AAPL', q: '   ' }))?.prompt)
      .toBeNull();
  });

  it.each(['BRK.B', 'BTC-USD', '^GSPC', '7203'])('accepts the current ticker syntax: %s', (symbol) => {
    expect(parseFinanceShareParams(new URLSearchParams({ sym: symbol }))?.ticker).toBe(symbol);
  });

  it.each([
    ['', 'missing'],
    ['BAD_SYMBOL', 'underscore'],
    ['ABCDEFGHIJK', 'more than ten characters'],
    ['AAPL!', 'unsupported punctuation'],
  ])('rejects %s as an invalid ticker (%s)', (symbol) => {
    expect(parseFinanceShareParams(new URLSearchParams({ sym: symbol }))).toBeNull();
  });
});

describe('formatCurrency', () => {
  it('formats finite values with the returned currency and two decimal places', () => {
    const expected = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(1234.5);

    expect(formatCurrency(1234.5, 'usd')).toBe(expected);
  });

  it('retains negative values', () => {
    const expected = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(-42.5);

    expect(formatCurrency(-42.5, ' CAD ')).toBe(expected);
  });

  it.each([
    [null, 'USD'],
    [undefined, 'USD'],
    [Number.NaN, 'USD'],
    [Number.POSITIVE_INFINITY, 'USD'],
    [1, null],
    [1, undefined],
    [1, ''],
    [1, 'US'],
  ])('returns N/A for an invalid value or currency (%s, %s)', (value, currency) => {
    expect(formatCurrency(value, currency)).toBe('N/A');
  });
});

describe('calculateRangePosition', () => {
  it('calculates a percentage from the actual low, high, and price', () => {
    expect(calculateRangePosition(150, 100, 200)).toBe(50);
    expect(calculateRangePosition(125, 100, 200)).toBe(25);
  });

  it('keeps exact endpoints', () => {
    expect(calculateRangePosition(100, 100, 200)).toBe(0);
    expect(calculateRangePosition(200, 100, 200)).toBe(100);
  });

  it('clamps prices outside the range', () => {
    expect(calculateRangePosition(50, 100, 200)).toBe(0);
    expect(calculateRangePosition(250, 100, 200)).toBe(100);
  });

  it.each([
    [null, 100, 200],
    [150, null, 200],
    [150, 100, null],
    [Number.NaN, 100, 200],
    [150, Number.NEGATIVE_INFINITY, 200],
    [150, 100, Number.POSITIVE_INFINITY],
    [150, 100, 100],
    [150, 200, 100],
  ])('returns null for invalid or non-increasing ranges (%s, %s, %s)', (price, low, high) => {
    expect(calculateRangePosition(price, low, high)).toBeNull();
  });
});

describe('validateComparisonSymbol', () => {
  it('returns a normalized valid symbol', () => {
    expect(validateComparisonSymbol(' msft ', 'AAPL', ['NVDA'])).toEqual({
      symbol: 'MSFT',
      error: null,
    });
  });

  it('accepts the same ticker punctuation as shared finance links', () => {
    expect(validateComparisonSymbol('brk.b', 'AAPL', [])).toEqual({
      symbol: 'BRK.B',
      error: null,
    });
    expect(validateComparisonSymbol('btc-usd', 'AAPL', [])).toEqual({
      symbol: 'BTC-USD',
      error: null,
    });
  });

  it.each(['', 'BAD_SYMBOL', 'ABCDEFGHIJK', 'AAPL!'])('rejects an invalid symbol: %s', (input) => {
    expect(validateComparisonSymbol(input, 'AAPL', [])).toEqual({
      symbol: input.trim().toUpperCase(),
      error: 'Enter a valid ticker symbol.',
    });
  });

  it('rejects the active ticker case-insensitively', () => {
    expect(validateComparisonSymbol('aapl', ' AAPL ', [])).toEqual({
      symbol: 'AAPL',
      error: 'AAPL is already the active ticker.',
    });
  });

  it('rejects an existing comparison case-insensitively', () => {
    expect(validateComparisonSymbol('nvda', 'AAPL', ['MSFT', ' NvDa '])).toEqual({
      symbol: 'NVDA',
      error: 'NVDA is already being compared.',
    });
  });

  it('rejects a fifth comparison using the default maximum', () => {
    expect(validateComparisonSymbol('TSLA', 'AAPL', ['MSFT', 'NVDA', 'GOOG', 'AMZN']))
      .toEqual({
        symbol: 'TSLA',
        error: 'You can compare up to 4 tickers.',
      });
  });

  it('supports a custom comparison maximum', () => {
    expect(validateComparisonSymbol('NVDA', 'AAPL', ['MSFT'], 1)).toEqual({
      symbol: 'NVDA',
      error: 'You can compare up to 1 tickers.',
    });
  });

  it('reports a duplicate before the maximum-limit error', () => {
    expect(validateComparisonSymbol('MSFT', 'AAPL', ['MSFT', 'NVDA', 'GOOG', 'AMZN']))
      .toMatchObject({ error: 'MSFT is already being compared.' });
  });
});
