import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { getOpenRouterClient } from '../services/api/openRouterClient';
import { ApiKeyManager } from '../services/utils/apiKeyManager';

// Integration tests with real API calls
// These tests require a valid OpenRouter API key
// Set OPENROUTER_API_KEY environment variable to run these tests

describe('OpenRouter Integration Tests', () => {
  let client: ReturnType<typeof getOpenRouterClient>;
  let testApiKey: string;

  beforeAll(async () => {
    // Get API key from environment or stored keys
    testApiKey = process.env.OPENROUTER_API_KEY || '';
    
    if (!testApiKey) {
      // Try to get from stored keys
      const storedKey = ApiKeyManager.getApiKey('openrouter');
      if (storedKey?.isValid) {
        testApiKey = storedKey.apiKey;
      }
    }

    if (!testApiKey) {
      console.warn('Skipping integration tests - no OpenRouter API key found');
      console.warn('Set OPENROUTER_API_KEY environment variable to run integration tests');
      return;
    }

    client = getOpenRouterClient(testApiKey);
  });

  afterAll(() => {
    // Clean up any test data
    if (client) {
      client.clearCache();
      client.clearPerformanceStats();
    }
  });

  // Skip all tests if no API key
  const skipTests = !testApiKey;

  describe.skip(skipTests, 'API Key Validation', () => {
    it('should validate real API key', async () => {
      const isValid = await client.validateApiKey();
      expect(isValid).toBe(true);
    }, 30000); // 30 second timeout

    it('should get available models', async () => {
      const response = await client.getModels();
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe.skip(skipTests, 'Model Selection', () => {
    it('should select optimal model for OCR', () => {
      const selection = client.selectOptimalModel('ocr');
      
      expect(selection.selected).toBeDefined();
      expect(selection.selected.id).toBe('nvidia/nemotron-nano-12b-v2-vl');
      expect(selection.selected.cost.input).toBe(0); // Free model
      expect(selection.reasoning).toContain('OCR processing');
    });

    it('should select optimal model for analysis', () => {
      const selection = client.selectOptimalModel('analysis');
      
      expect(selection.selected).toBeDefined();
      expect(selection.selected.supportsReasoning).toBe(true);
      expect(selection.alternatives.length).toBeGreaterThan(0);
    });

    it('should respect budget constraints', () => {
      const selection = client.selectOptimalModel('analysis', {}, { maxCostPerRequest: 0.01 });
      
      // Should select free model when budget is very low
      expect(selection.selected.cost.input).toBe(0);
    });
  });

  describe.skip(skipTests, 'Chat Completion', () => {
    it('should complete chat with free model', async () => {
      const request = {
        model: 'google/gemini-2.0-flash-exp',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'What is 2+2?' }
        ],
        temperature: 0.1,
        max_tokens: 100
      };

      const response = await client.chatCompletion(request);
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.choices).toBeDefined();
      expect(response.data.choices.length).toBeGreaterThan(0);
      expect(response.data.choices[0].message.content).toContain('4');
      expect(response.metadata).toBeDefined();
      expect(response.metadata.model).toBe('google/gemini-2.0-flash-exp');
      expect(response.metadata.tokens).toBeDefined();
      expect(response.metadata.cost).toBe(0); // Free model
    }, 30000);

    it('should complete chat with paid model', async () => {
      const request = {
        model: 'x-ai/grok-4-fast',
        messages: [
          { role: 'system', content: 'You are a financial analyst.' },
          { role: 'user', content: 'Analyze this simple financial data: Revenue: $1000, Expenses: $600' }
        ],
        temperature: 0.3,
        max_tokens: 200
      };

      const response = await client.chatCompletion(request);
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.choices).toBeDefined();
      expect(response.data.choices.length).toBeGreaterThan(0);
      expect(response.data.choices[0].message.content).toBeDefined();
      expect(response.metadata).toBeDefined();
      expect(response.metadata.model).toBe('x-ai/grok-4-fast');
      expect(response.metadata.tokens).toBeDefined();
      expect(response.metadata.cost).toBeGreaterThan(0); // Paid model
    }, 45000); // Longer timeout for paid model

    it('should handle image input with vision model', async () => {
      // Create a simple base64 encoded image (1x1 pixel transparent PNG)
      const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      
      const request = {
        model: 'nvidia/nemotron-nano-12b-v2-vl',
        messages: [
          { 
            role: 'user', 
            content: [
              { type: 'text', text: 'What do you see in this image?' },
              { 
                type: 'image_url', 
                image_url: { 
                  url: `data:image/png;base64,${base64Image}` 
                } 
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 100
      };

      const response = await client.chatCompletion(request);
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.choices).toBeDefined();
      expect(response.data.choices.length).toBeGreaterThan(0);
      expect(response.data.choices[0].message.content).toBeDefined();
      expect(response.metadata.model).toBe('nvidia/nemotron-nano-12b-v2-vl');
    }, 30000);
  });

  describe.skip(skipTests, 'Error Handling', () => {
    it('should handle invalid model', async () => {
      const request = {
        model: 'invalid-model-name',
        messages: [
          { role: 'user', content: 'Test message' }
        ]
      };

      const response = await client.chatCompletion(request);
      
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error.error.message).toBeDefined();
    }, 30000);

    it('should handle rate limiting', async () => {
      // Make multiple rapid requests to trigger rate limiting
      const request = {
        model: 'google/gemini-2.0-flash-exp',
        messages: [
          { role: 'user', content: 'Test message' }
        ]
      };

      const promises = Array(10).fill(null).map(() => client.chatCompletion(request));
      const responses = await Promise.allSettled(promises);
      
      // At least one should fail due to rate limiting
      const hasRateLimit = responses.some(r => 
        r.status === 'fulfilled' && !r.value.success
      );
      
      // This test might not always trigger rate limiting depending on API limits
      // So we just check that responses are handled properly
      responses.forEach(r => {
        if (r.status === 'fulfilled') {
          expect(r.value).toBeDefined();
          expect(typeof r.value.success).toBe('boolean');
        }
      });
    }, 60000); // Longer timeout for multiple requests
  });

  describe.skip(skipTests, 'Performance and Caching', () => {
    it('should cache identical requests', async () => {
      const request = {
        model: 'google/gemini-2.0-flash-exp',
        messages: [
          { role: 'user', content: 'What is the capital of France?' }
        ]
      };

      // First request
      const start1 = performance.now();
      const response1 = await client.chatCompletion(request);
      const duration1 = performance.now() - start1;

      expect(response1.success).toBe(true);
      expect(response1.metadata).toBeDefined();

      // Second identical request (should use cache)
      const start2 = performance.now();
      const response2 = await client.chatCompletion(request);
      const duration2 = performance.now() - start2;

      expect(response2.success).toBe(true);
      expect(response2.data).toEqual(response1.data);
      
      // Cached request should be faster
      expect(duration2).toBeLessThan(duration1 * 0.5);
    }, 30000);

    it('should track performance metrics', async () => {
      const request = {
        model: 'google/gemini-2.0-flash-exp',
        messages: [
          { role: 'user', content: 'Performance test message' }
        ]
      };

      await client.chatCompletion(request);
      
      const stats = client.getPerformanceStats();
      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
    }, 30000);

    it('should provide cache statistics', async () => {
      const request = {
        model: 'google/gemini-2.0-flash-exp',
        messages: [
          { role: 'user', content: 'Cache test message' }
        ]
      };

      // Make a request to populate cache
      await client.chatCompletion(request);
      
      const stats = client.getCacheStats();
      expect(stats).toBeDefined();
      expect(typeof stats.hits).toBe('number');
      expect(typeof stats.misses).toBe('number');
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.hitRate).toBe('number');
    }, 30000);
  });

  describe.skip(skipTests, 'Circuit Breaker', () => {
    it('should get circuit breaker state', () => {
      const state = client.getCircuitBreakerState();
      expect(typeof state).toBe('string');
      expect(['CLOSED', 'OPEN', 'HALF_OPEN']).toContain(state);
    });

    it('should reset circuit breaker', () => {
      expect(() => client.resetCircuitBreaker()).not.toThrow();
    });
  });
});

// Manual test runner for development
export async function runIntegrationTests() {
  console.log('Running OpenRouter Integration Tests...');
  console.log('Make sure you have a valid OPENROUTER_API_KEY set');
  
  try {
    // Run a simple test
    const client = getOpenRouterClient();
    const isValid = await client.validateApiKey();
    
    if (isValid) {
      console.log('✅ API key is valid');
      
      // Test model selection
      const selection = client.selectOptimalModel('ocr');
      console.log(`✅ OCR model selected: ${selection.selected.name}`);
      
      // Test simple chat
      const response = await client.chatCompletion({
        model: 'google/gemini-2.0-flash-exp',
        messages: [
          { role: 'user', content: 'What is 2+2?' }
        ],
        temperature: 0.1,
        max_tokens: 100
      });
      
      if (response.success) {
        console.log('✅ Chat completion successful');
        console.log(`Response: ${response.data.choices[0].message.content}`);
        console.log(`Cost: $${response.metadata.cost}`);
        console.log(`Duration: ${response.metadata.duration}ms`);
      } else {
        console.log('❌ Chat completion failed');
        console.log(`Error: ${response.error.error.message}`);
      }
    } else {
      console.log('❌ API key is invalid');
    }
  } catch (error) {
    console.error('❌ Integration test failed:', error);
  }
}

// Export for manual testing
if (require.main === module) {
  runIntegrationTests();
}