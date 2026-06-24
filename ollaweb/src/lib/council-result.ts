import type { ConfidenceLevel, CouncilEvent, IndividualResponse } from './types';

export interface CouncilResult {
  individualResponses: IndividualResponse[];
  consensusText: string;
  confidence?: ConfidenceLevel;
  complete: boolean;
}

export function createCouncilResult(models: readonly string[]): CouncilResult {
  return {
    individualResponses: models.map((model, index) => ({
      model,
      index,
      text: '',
      status: 'pending',
    })),
    consensusText: '',
    complete: false,
  };
}

export function applyCouncilEvent(result: CouncilResult, event: CouncilEvent): CouncilResult {
  if (event.event === 'synthesis_chunk') {
    return {
      ...result,
      consensusText: result.consensusText + event.payload.text,
    };
  }

  if (event.event === 'synthesis_complete') {
    return {
      ...result,
      consensusText: event.payload.fullText,
      confidence: event.payload.confidence,
      complete: true,
    };
  }

  if (!event.event.startsWith('individual_')) return result;

  const index = event.payload.index;
  const current = result.individualResponses[index];
  if (!current) return result;

  const individualResponses = [...result.individualResponses];

  switch (event.event) {
    case 'individual_start':
      individualResponses[index] = { ...current, status: 'streaming' };
      break;
    case 'individual_chunk':
      individualResponses[index] = { ...current, text: current.text + event.payload.text };
      break;
    case 'individual_complete':
      individualResponses[index] = {
        ...current,
        text: event.payload.fullText,
        status: 'complete',
      };
      break;
    case 'individual_error':
      individualResponses[index] = {
        ...current,
        status: 'error',
        error: event.payload.error,
        errorAction: event.payload.action,
      };
      break;
  }

  return { ...result, individualResponses };
}
