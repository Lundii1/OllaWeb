import { describe, expect, it } from 'vitest';
import { applyCouncilEvent, createCouncilResult } from '../council-result';

describe('council result accumulation', () => {
  it('accumulates adviser output and the final synthesis', () => {
    let result = createCouncilResult(['a', 'b', 'c']);

    result = applyCouncilEvent(result, { event: 'individual_start', payload: { index: 0 } });
    result = applyCouncilEvent(result, { event: 'individual_chunk', payload: { index: 0, text: 'partial' } });
    result = applyCouncilEvent(result, { event: 'individual_complete', payload: { index: 0, fullText: 'complete answer' } });
    result = applyCouncilEvent(result, { event: 'synthesis_chunk', payload: { text: 'partial consensus' } });
    result = applyCouncilEvent(result, { event: 'synthesis_complete', payload: { fullText: 'consensus', confidence: 'strong' } });

    expect(result.individualResponses[0]).toMatchObject({ text: 'complete answer', status: 'complete' });
    expect(result).toMatchObject({ consensusText: 'consensus', confidence: 'strong', complete: true });
  });

  it('ignores events for an unknown adviser index', () => {
    const result = createCouncilResult(['a', 'b', 'c']);
    const updated = applyCouncilEvent(result, { event: 'individual_chunk', payload: { index: 9, text: 'ignored' } });

    expect(updated).toBe(result);
  });
});
