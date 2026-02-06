export type ChatMode = 'single' | 'council';

export type ConfidenceLevel = 'strong' | 'moderate' | 'mixed' | 'disagreement' | 'unknown';

export type CouncilEventType =
  | 'health_check'
  | 'individual_start'
  | 'individual_chunk'
  | 'individual_complete'
  | 'individual_error'
  | 'debate_start'
  | 'debate_chunk'
  | 'debate_complete'
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
  errorAction?: string;
}

export interface CouncilState {
  phase: 'idle' | 'health_check' | 'individual' | 'debating' | 'synthesizing' | 'complete' | 'error';
  individualResponses: IndividualResponse[];
  consensusText: string;
  moderatorModel: string;
  confidence?: ConfidenceLevel;
}

export interface CouncilConfig {
  models: [string, string, string];
  moderatorIndex: number;
}

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  councilData?: IndividualResponse[];
  councilConfidence?: ConfidenceLevel;
  image?: string;
};

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  chatMode: ChatMode;
  model: string;
  councilModels?: [string, string, string];
  moderatorIndex?: number;
  createdAt: number;
  updatedAt: number;
}

export const AVAILABLE_MODELS = [
  { value: 'llama3.2', label: 'Llama 3.2 (2B|2GB) 💬', vision: false },
  { value: 'mistral', label: 'Mistral (7B|4.1GB) 💬', vision: false },
  { value: 'deepseek-r1:7b', label: 'Deepseek-R1 7B (7B|4.7GB) 💬', vision: false },
  { value: 'phi4-mini-reasoning:latest', label: 'Phi-4 Mini Reasoning (3.8B|2.2GB) 💬', vision: false },
  { value: 'qwen3-vl:4b', label: 'Qwen3-VL (4B|2.5GB) 💬👁️', vision: true },
] as const;

export const DEFAULT_COUNCIL_MODELS: [string, string, string] = [
  'llama3.2',
  'mistral',
  'deepseek-r1:7b',
];
