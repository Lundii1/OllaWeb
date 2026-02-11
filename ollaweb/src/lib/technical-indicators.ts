/**
 * Technical indicator calculations for stock chart overlays.
 * All functions take arrays of closing prices and return computed values.
 */

export function computeSMA(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += closes[j];
      }
      result.push(sum / period);
    }
  }
  return result;
}

export function computeEMA(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const k = 2 / (period + 1);

  // Start with SMA for the first EMA value
  let ema: number | null = null;
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += closes[j];
      ema = sum / period;
      result.push(ema);
    } else {
      ema = closes[i] * k + ema! * (1 - k);
      result.push(ema);
    }
  }
  return result;
}

export function computeRSI(closes: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];
  if (closes.length < period + 1) {
    return closes.map(() => null);
  }

  // Calculate initial gains and losses
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }

  // First RSI uses simple average
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  avgGain /= period;
  avgLoss /= period;

  // First period values are null
  for (let i = 0; i < period; i++) {
    result.push(null);
  }

  // Calculate RSI
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push(100 - 100 / (1 + rs));

  // Subsequent values use smoothed average
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }

  return result;
}

export function computeMACD(
  closes: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  const fastEMA = computeEMA(closes, fastPeriod);
  const slowEMA = computeEMA(closes, slowPeriod);

  // MACD line = fast EMA - slow EMA
  const macdLine: (number | null)[] = fastEMA.map((f, i) => {
    const s = slowEMA[i];
    return f != null && s != null ? f - s : null;
  });

  // Signal line = EMA of MACD line
  const nonNullMACD = macdLine.filter((v): v is number => v != null);
  const signalEMA = computeEMA(nonNullMACD, signalPeriod);

  // Map signal back to original indices
  const signal: (number | null)[] = [];
  let signalIdx = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] == null) {
      signal.push(null);
    } else {
      signal.push(signalEMA[signalIdx] ?? null);
      signalIdx++;
    }
  }

  // Histogram = MACD - Signal
  const histogram: (number | null)[] = macdLine.map((m, i) => {
    const s = signal[i];
    return m != null && s != null ? m - s : null;
  });

  return { macd: macdLine, signal, histogram };
}

export function computeBollingerBands(
  closes: number[],
  period: number = 20,
  stdDevMultiplier: number = 2
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const middle = computeSMA(closes, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1 || middle[i] == null) {
      upper.push(null);
      lower.push(null);
    } else {
      // Calculate standard deviation
      let sumSq = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const diff = closes[j] - middle[i]!;
        sumSq += diff * diff;
      }
      const stdDev = Math.sqrt(sumSq / period);
      upper.push(middle[i]! + stdDevMultiplier * stdDev);
      lower.push(middle[i]! - stdDevMultiplier * stdDev);
    }
  }

  return { upper, middle, lower };
}
