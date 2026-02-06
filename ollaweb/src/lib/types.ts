export type ChatMode = 'single' | 'council';

export type CouncilEventType =
  | 'individual_start'
  | 'individual_chunk'
  | 'individual_complete'
  | 'individual_error'
  | 'synthesis_start'
  | 'synthesis_chunk'
  | 'synthesis_complete'
  | 'error';

export interface CouncilEvent {
  event: CouncilEventType;
  payload: Record<string, any>;
}

export interface IndividualResponse {
  model: string;
  index: number;
  text: string;
  status: 'pending' | 'streaming' | 'complete' | 'error';
  error?: string;
}

export interface CouncilState {
  phase: 'idle' | 'individual' | 'synthesizing' | 'complete' | 'error';
  individualResponses: IndividualResponse[];
  consensusText: string;
  moderatorModel: string;
}

export interface CouncilConfig {
  models: [string, string, string];
  moderatorIndex: number;
}

export const AVAILABLE_MODELS = [
  { value: 'llama3.2', label: 'Llama 3.2 (2B|2GB) 💬', vision: false },
  { value: 'mistral', label: 'Mistral (7B|4.1GB) 💬', vision: false },
  { value: 'qwq', label: 'QwQ (32B|20GB) 💬', vision: false },
  { value: 'deepseek-r1:7b', label: 'Deepseek-R1 7B (7B|4.7GB) 💬', vision: false },
  { value: 'deepseek-r1:32b', label: 'Deepseek-R1 32B (32B|20GB) 💬', vision: false },
  { value: 'llava-llama3', label: 'Llava-llama3 (8B|5.5GB) 💬👁️', vision: true },
  { value: 'llama3.2-vision', label: 'Llama 3.2 Vision (11B|7.9GB) 💬👁️', vision: true },
] as const;

export const DEFAULT_COUNCIL_MODELS: [string, string, string] = [
  'llama3.2',
  'mistral',
  'deepseek-r1:7b',
];
