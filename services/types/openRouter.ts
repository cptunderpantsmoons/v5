// OpenRouter API Types and Interfaces

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | OpenRouterContent[];
}

export interface OpenRouterContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  response_format?: {
    type: 'text' | 'json_object';
  };
  tools?: OpenRouterTool[];
  tool_choice?: 'auto' | 'required' | { type: string; function: OpenRouterToolFunction };
  reasoning?: {
    enabled?: boolean;
    max_tokens?: number;
  };
}

export interface OpenRouterTool {
  type: 'function';
  function: OpenRouterToolFunction;
}

export interface OpenRouterToolFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface OpenRouterResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: OpenRouterChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  reasoning?: {
    tokens: number;
    details: string;
  };
}

export interface OpenRouterChoice {
  index: number;
  message: OpenRouterMessage;
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  tool_calls?: OpenRouterToolCall[];
}

export interface OpenRouterToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenRouterError {
  error: {
    message: string;
    type: string;
    code: string;
  };
}

export interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  pricing: {
    prompt: string;
    completion: string;
    request: string;
    image: string;
  };
  context_length: number;
  top_provider: {
    context_length: number;
    max_completion_tokens: number;
    is_moderated: boolean;
  };
}

export interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

// Model-specific configurations
export interface ModelConfig {
  id: string;
  name: string;
  cost: {
    input: number; // Cost per million input tokens
    output: number; // Cost per million output tokens
  };
  context: number;
  supportsVision: boolean;
  supportsTools: boolean;
  supportsReasoning: boolean;
  category: 'ocr' | 'fast' | 'premium';
}

// Predefined model configurations
export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'nvidia/nemotron-nano-12b-v2-vl': {
    id: 'nvidia/nemotron-nano-12b-v2-vl',
    name: 'NVIDIA Nemotron Nano 12B 2 VL',
    cost: { input: 0, output: 0 }, // FREE
    context: 128000,
    supportsVision: true,
    supportsTools: false,
    supportsReasoning: false,
    category: 'ocr'
  },
  'google/gemini-2.0-flash-exp': {
    id: 'google/gemini-2.0-flash-exp',
    name: 'Google Gemini 2.0 Flash Experimental',
    cost: { input: 0, output: 0 }, // FREE
    context: 1048576,
    supportsVision: true,
    supportsTools: true,
    supportsReasoning: false,
    category: 'fast'
  },
  'x-ai/grok-4-fast': {
    id: 'x-ai/grok-4-fast',
    name: 'xAI Grok 4 Fast',
    cost: { input: 0.20, output: 0.50 }, // $0.20/M input, $0.50/M output
    context: 2000000,
    supportsVision: true,
    supportsTools: true,
    supportsReasoning: true,
    category: 'premium'
  },
  'elevenlabs/eleven-multilingual-v2': {
    id: 'elevenlabs/eleven-multilingual-v2',
    name: 'ElevenLabs Multilingual v2',
    cost: { input: 0.30, output: 0.30 }, // $0.30/M input, $0.30/M output
    context: 1024,
    supportsVision: false,
    supportsTools: false,
    supportsReasoning: false,
    category: 'premium'
  },
  'openai/tts-1': {
    id: 'openai/tts-1',
    name: 'OpenAI TTS-1',
    cost: { input: 15, output: 0 }, // $15/M input
    context: 2048,
    supportsVision: false,
    supportsTools: false,
    supportsReasoning: false,
    category: 'premium'
  }
};

// Task types for model selection
export type TaskType = 'ocr' | 'analysis' | 'generation' | 'correction' | 'audio';

// Priority types for model selection
export type PriorityType = 'cost' | 'speed' | 'quality';

// Model requirements
export interface ModelRequirements {
  hasImages?: boolean;
  maxTokens?: number;
  priority?: PriorityType;
  supportsReasoning?: boolean;
}

// Budget constraints
export interface BudgetConstraints {
  maxCostPerRequest?: number;
  dailyLimit?: number;
  monthlyLimit?: number;
}

// Model selection result
export interface ModelSelection {
  selected: ModelConfig;
  alternatives: ModelConfig[];
  reasoning: string;
}

// API response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: OpenRouterError;
  metadata?: {
    model: string;
    tokens: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
    cost: number;
    duration: number;
    reasoning?: boolean;
  };
}

// Usage tracking
export interface UsageRecord {
  timestamp: Date;
  model: string;
  taskType: TaskType;
  tokens: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  cost: number;
  duration: number;
}

// Cost tracking
export interface CostTracker {
  recordUsage(record: UsageRecord): void;
  getDailyUsage(): DailyUsage;
  getMonthlyUsage(): MonthlyUsage;
  isWithinLimits(): { daily: boolean; monthly: boolean };
}

export interface DailyUsage {
  date: string;
  totalCost: number;
  totalTokens: number;
  requestCount: number;
  modelBreakdown: Record<string, { cost: number; tokens: number; requests: number }>;
}

export interface MonthlyUsage {
  month: string;
  totalCost: number;
  totalTokens: number;
  requestCount: number;
  modelBreakdown: Record<string, { cost: number; tokens: number; requests: number }>;
}