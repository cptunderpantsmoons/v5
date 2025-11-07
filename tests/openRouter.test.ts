
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { OpenRouterClient } from '../services/api/openRouterClient';
import { ApiCache } from '../services/utils/cacheManager';

// Mock fetch for testing
global.fetch = jest.fn();

describe('OpenRouter Client', () => {
  let client: OpenRouterClient;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    client = new OpenRouterClient('test-api-key');
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    
    // Clear cache before each test
    const apiCache = new ApiCache();
    apiCache.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('API Key Validation', () => {
    it('should validate API key successfully', async () => {
      // Mock successful models response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [
            { id: 'test-model', name: 'Test Model' }
          ]
        })
      } as Response);

      const isValid = await client.validateApiKey();
      expect(isValid).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('openrouter.ai/api/v1/models'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key'
          })
        })
      );
    });

    it('should handle API key validation failure', async () => {
      // Mock failed response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          error: {
            message: 'Invalid API key'
          }
        })
      } as Response);

      const isValid = await client.validateApiKey();
      expect(isValid).toBe(false);
    });
  });

  describe('Model Selection', () => {
    it('should select optimal model for OCR task', () => {
      const selection = client.selectOptimalModel('ocr');
      
      expect(selection.selected.id).toBe('nvidia/nemotron-nano-12b-v2-vl');
      expect(selection.reasoning).toContain('OCR processing');
      expect(selection.selected.cost.input).toBe(0); // Free model
    });

    it('should select optimal model for analysis task with images', () => {
      const selection = client.selectOptimalModel('analysis', { hasImages: true });
      
      expect(selection.selected.supportsVision).toBe(true);
      expect(selection.selected.supportsReasoning).toBe(true);
    });

    it('should respect budget constraints', () => {
      const selection = client.selectOptimalModel('generation', {}, { maxCostPerRequest: 0.1 });
      
      // Should select free model when budget is very low
      expect(selection.selected.cost.input).toBe(0);
    });

    it('should prioritize cost when requested', () => {
      const selection = client.selectOptimalModel('analysis', { priority: 'cost' });
      
      // Should select model with lowest cost
      const costs = [selection.selected, ...selection.alternatives].map(m => 
        m.cost.input + m.cost.output
      );
      expect(costs[0]).toBeLessThanOrEqual(costs[1]);
    });
  });

  describe('Chat Completion', () => {
    it('should make successful chat completion request', async () => {
      const mockResponse = {
        id: 'chat-test-id',
        model: 'x-ai/grok-4-fast',
        choices: [
          {
            message: {
              content: 'Test response'
            }
          }
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      const request = {
        model: 'x-ai/grok-4-fast',
        messages: [
          { role: 'user', content: 'Test message' }
        ]
      };

      const response = await client.chatCompletion(request);
      
      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockResponse);
      expect(response.metadata?.model).toBe('x-ai/grok-4-fast');
      expect(response.metadata?.cost).toBeGreaterThan(0);
    });

    it('should handle chat completion errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve({
          error: {
            message: 'Rate limit exceeded',
            type: 'rate_limit_error'
          }
        })
      } as Response);

      const request = {
        model: 'x-ai/grok-4-fast',
        messages: [
          { role: 'user', content: 'Test message' }
        ]
      };

      const response = await client.chatCompletion(request);
      
      expect(response.success).toBe(false);
      expect(response.error?.error.message).toContain('Rate limit');
    });

    it('should use cache for identical requests', async () => {
      const mockResponse = {
        id: 'cached-response-id',
        model: 'x-ai/grok-4-fast',
        choices: [
          {
            message: {
              content: 'Cached response'
            }
          }
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5
        }
      };

      // First call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      const request = {
        model: 'x-ai/grok-4-fast',
        messages: [
          { role: 'user', content: 'Test message' }
        ]
      };

      const response1 = await client.chatCompletion(request);
      expect(response1.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second identical call should use cache
      const response2 = await client.chatCompletion(request);
      expect(response2.success).toBe(true);
      expect(response2.data).toEqual(mockResponse);
      // Should not make additional API call
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const request = {
        model: 'x-ai/grok-4-fast',
        messages: [
          { role: 'user', content: 'Test message' }
        ]
      };

      const response = await client.chatCompletion(request);
      
      expect(response.success).toBe(false);
      expect(response.error?.error.type).toBe('network');
    });

    it('should handle timeout errors', async () => {
      mockFetch.mockRejectedValueOnce(new DOMException('Request timeout', 'AbortError'));

      const request = {
        model: 'x-ai/grok-4-fast',
        messages: [
          { role: 'user', content: 'Test message' }
        ]
      };

      const response = await client.chatCompletion(request);
      
      expect(response.success).toBe(false);
      expect(response.error?.error.type).toBe('timeout');
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit after multiple failures', async () => {
      // Mock multiple failures
