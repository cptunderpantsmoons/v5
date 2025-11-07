import type { 
  OpenRouterRequest, 
  OpenRouterResponse, 
  OpenRouterModelsResponse,
  OpenRouterError,
  ApiResponse,
  ModelConfig,
  TaskType,
  PriorityType,
  ModelRequirements,
  BudgetConstraints,
  ModelSelection
} from '../types/openRouter';
import { MODEL_CONFIGS } from '../types/openRouter';
import { ApiRetryHandler, CircuitBreaker, ErrorHandler } from '../utils/retryHandler';
import { apiCache, measurePerformance, performanceMonitor } from '../utils/cacheManager';

// Declare process for browser environment
declare const process: {
  env: {
    OPENROUTER_API_KEY?: string;
    [key: string]: string | undefined;
  };
};

export class OpenRouterClient {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private circuitBreaker: CircuitBreaker;

  constructor(apiKey: string, timeout: number = 30000) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://openrouter.ai/api/v1';
    this.timeout = timeout;
    this.circuitBreaker = new CircuitBreaker(5, 60000, 30000);
  }

  async chatCompletion(request: OpenRouterRequest): Promise<ApiResponse<OpenRouterResponse>> {
    const startTime = Date.now();
    
    try {
      // Check cache first for identical requests
      const cacheKey = this.generateCacheKey('chat/completions', request);
      const cachedResponse = apiCache.get(cacheKey, null);
      
      if (cachedResponse) {
        console.log('Using cached response for chat completion');
        return cachedResponse;
      }

      const response = await this.circuitBreaker.execute(async () => {
        return await measurePerformance('openrouter_chat_completion', async () => {
          return await ApiRetryHandler.executeApiCall(
            () => this.makeRequest(`${this.baseUrl}/chat/completions`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
                'X-Title': 'Financial Report Generator'
              },
              body: JSON.stringify(request),
              signal: AbortSignal.timeout(this.timeout)
            }),
            'OpenRouter chat completion'
          );
        }, performanceMonitor);
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.createError(response.status, errorData);
      }

      const data: OpenRouterResponse = await response.json();
      const duration = Date.now() - startTime;
      
      const apiResponse: ApiResponse<OpenRouterResponse> = {
        success: true,
        data,
        metadata: {
          model: data.model,
          tokens: data.usage,
          cost: this.calculateCost(data.model, data.usage),
          duration,
          reasoning: !!data.reasoning
        }
      };

      // Cache successful response for 5 minutes
      apiCache.set(cacheKey, apiResponse, 300000);
      
      return apiResponse;
    } catch (error) {
      const errorClassification = ErrorHandler.classifyError(error);
      return {
        success: false,
        error: {
          error: {
            message: errorClassification.userMessage,
            type: errorClassification.type,
            code: errorClassification.retryable ? 'RETRYABLE' : 'NON_RETRYABLE'
          }
        }
      };
    }
  }

  async getModels(): Promise<ApiResponse<any[]>> {
    try {
      // Check cache first
      const cacheKey = 'models';
      const cachedResponse = apiCache.get(cacheKey, null);
      
      if (cachedResponse) {
        console.log('Using cached models list');
        return cachedResponse;
      }

      const response = await this.circuitBreaker.execute(async () => {
        return await measurePerformance('openrouter_get_models', async () => {
          return await ApiRetryHandler.executeApiCall(
            () => this.makeRequest(`${this.baseUrl}/models`, {
              headers: {
                'Authorization': `Bearer ${this.apiKey}`
              }
            }),
            'OpenRouter get models'
          );
        }, performanceMonitor);
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.createError(response.status, errorData);
      }

      const data = await response.json();
      const apiResponse: ApiResponse<any[]> = {
        success: true,
        data: data.data
      };

      // Cache models list for 1 hour
      apiCache.set(cacheKey, apiResponse, 3600000);
      
      return apiResponse;
    } catch (error) {
      const errorClassification = ErrorHandler.classifyError(error);
      return {
        success: false,
        error: {
          error: {
            message: errorClassification.userMessage,
            type: errorClassification.type,
            code: errorClassification.retryable ? 'RETRYABLE' : 'NON_RETRYABLE'
          }
        }
      };
    }
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const response = await this.getModels();
      return response.success;
    } catch (error) {
      console.error('API key validation failed:', error);
      return false;
    }
  }

  selectOptimalModel(
    taskType: TaskType,
    requirements: ModelRequirements = {},
    budget: BudgetConstraints = {}
  ): ModelSelection {
    // Get candidate models for task
    const candidates = this.getCandidateModels(taskType, requirements);
    
    // Filter by budget constraints
    const affordable = candidates.filter(model => {
      if (budget.maxCostPerRequest && this.estimateCost(model) > budget.maxCostPerRequest) {
        return false;
      }
      return true;
    });

    // Sort by priority
    const sorted = this.sortByPriority(affordable, requirements.priority || 'cost');

    return {
      selected: sorted[0],
      alternatives: sorted.slice(1, 3),
      reasoning: this.getSelectionReasoning(sorted[0], taskType, requirements)
    };
  }

  private generateCacheKey(endpoint: string, request: any): string {
    // Create a deterministic key from request parameters
    const keyData = {
      endpoint,
      model: request.model,
      messages: request.messages?.map((m: any) => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : 
          Array.isArray(m.content) ? m.content.map((c: any) => 
            c.type === 'text' ? c.text.substring(0, 100) : '[binary]'
          ) : '[complex]'
      })),
      temperature: request.temperature,
      max_tokens: request.max_tokens
    };
    
    return btoa(JSON.stringify(keyData));
  }

  private async makeRequest(url: string, options: RequestInit): Promise<Response> {
    return fetch(url, options);
  }

  private getCandidateModels(taskType: TaskType, requirements: ModelRequirements): ModelConfig[] {
    switch (taskType) {
      case 'ocr':
        return [MODEL_CONFIGS['nvidia/nemotron-nano-12b-v2-vl']];
      case 'correction':
        return [
          MODEL_CONFIGS['google/gemini-2.0-flash-exp'],
          MODEL_CONFIGS['x-ai/grok-4-fast']
        ];
      case 'analysis':
      case 'generation':
        return requirements.hasImages 
          ? [
              MODEL_CONFIGS['x-ai/grok-4-fast'],
              MODEL_CONFIGS['google/gemini-2.0-flash-exp'],
              MODEL_CONFIGS['nvidia/nemotron-nano-12b-v2-vl']
            ]
          : [
              MODEL_CONFIGS['x-ai/grok-4-fast'],
              MODEL_CONFIGS['google/gemini-2.0-flash-exp']
            ];
      case 'audio':
        return [
          MODEL_CONFIGS['elevenlabs/eleven-multilingual-v2'],
          MODEL_CONFIGS['openai/tts-1']
        ];
      default:
        return [
          MODEL_CONFIGS['x-ai/grok-4-fast'],
          MODEL_CONFIGS['google/gemini-2.0-flash-exp']
        ];
    }
  }

  private sortByPriority(models: ModelConfig[], priority: PriorityType): ModelConfig[] {
    switch (priority) {
      case 'cost':
        return models.sort((a, b) => {
          const aCost = a.cost.input + a.cost.output;
          const bCost = b.cost.input + b.cost.output;
          return aCost - bCost;
        });
      case 'speed':
        return models.sort((a, b) => b.context - a.context);
      case 'quality':
        return models.sort((a, b) => {
          // Prioritize reasoning capabilities, then context
          if (a.supportsReasoning && !b.supportsReasoning) return -1;
          if (!a.supportsReasoning && b.supportsReasoning) return 1;
          return b.context - a.context;
        });
      default:
        return models;
    }
  }

  private getSelectionReasoning(model: ModelConfig, taskType: TaskType, requirements: ModelRequirements): string {
    const reasons = {
      'ocr': `Selected ${model.name} for specialized OCR processing with high accuracy and free usage.`,
      'correction': `Selected ${model.name} for fast error correction with ${model.cost.input === 0 ? 'free' : 'cost-effective'} processing.`,
      'analysis': `Selected ${model.name} for financial analysis with ${model.supportsReasoning ? 'advanced reasoning' : 'fast processing'} capabilities.`,
      'generation': `Selected ${model.name} for report generation with ${model.supportsReasoning ? 'enhanced quality' : 'optimal speed'}.`
    };

    return reasons[taskType] || `Selected ${model.name} based on task requirements and priority settings.`;
  }

  private estimateCost(model: ModelConfig): number {
    // Estimate cost for average request (1000 input, 500 output tokens)
    const inputTokens = 1000;
    const outputTokens = 500;
    return (inputTokens * model.cost.input / 1000000) + (outputTokens * model.cost.output / 1000000);
  }

  private calculateCost(model: string, usage: { prompt_tokens: number; completion_tokens: number }): number {
    const modelConfig = MODEL_CONFIGS[model];
    if (!modelConfig) {
      // Default to Grok pricing if model not found
      return (usage.prompt_tokens * 0.20 / 1000000) + (usage.completion_tokens * 0.50 / 1000000);
    }

    return (usage.prompt_tokens * modelConfig.cost.input / 1000000) + 
           (usage.completion_tokens * modelConfig.cost.output / 1000000);
  }

  private createError(status: number, errorData: any): OpenRouterError {
    return {
      error: {
        message: errorData?.error?.message || `HTTP ${status} error`,
        type: errorData?.error?.type || 'api_error',
        code: errorData?.error?.code || status.toString()
      }
    };
  }

  // Circuit breaker methods
  getCircuitBreakerState(): string {
    return this.circuitBreaker.getState();
  }

  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }

  // Cache management methods
  clearCache(): void {
    apiCache.clear();
    console.log('OpenRouter API cache cleared');
  }

  getCacheStats(): any {
    return apiCache.getStats();
  }

  // Performance monitoring methods
  getPerformanceStats(): any {
    return performanceMonitor.getAllStats();
  }

  clearPerformanceStats(): void {
    performanceMonitor.clear();
  }
}

// Export singleton instance
let openRouterClient: OpenRouterClient | null = null;

export function getOpenRouterClient(apiKey?: string): OpenRouterClient {
  if (!openRouterClient) {
    const key = apiKey || (typeof process !== 'undefined' ? process.env.OPENROUTER_API_KEY : '') || '';
    if (!key) {
      throw new Error('OpenRouter API key is required');
    }
    openRouterClient = new OpenRouterClient(key);
  }
  return openRouterClient;
}

export function resetOpenRouterClient(): void {
  openRouterClient = null;
}