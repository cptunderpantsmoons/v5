export interface ApiKeyConfig {
  provider: 'openrouter' | 'gemini';
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  lastValidated?: Date;
  isValid?: boolean;
}

export interface ApiKeyValidationResult {
  isValid: boolean;
  provider: string;
  error?: string;
  lastValidated: Date;
  usage?: {
    daily: number;
    monthly: number;
  };
}

export class ApiKeyManager {
  private static readonly STORAGE_KEY = 'api_keys';
  private static readonly VALIDATION_CACHE_KEY = 'api_key_validation';
  private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  // Store API keys securely
  static storeApiKey(config: ApiKeyConfig): void {
    try {
      const existingKeys = this.getAllApiKeys();
      existingKeys[config.provider] = config;
      
      // Encrypt before storing (in a real implementation, use proper encryption)
      const encrypted = btoa(JSON.stringify(existingKeys));
      localStorage.setItem(this.STORAGE_KEY, encrypted);
      
      console.log(`API key stored for ${config.provider}`);
    } catch (error) {
      console.error('Failed to store API key:', error);
      throw new Error('Failed to store API key securely');
    }
  }

  // Get API key for specific provider
  static getApiKey(provider: 'openrouter' | 'gemini'): ApiKeyConfig | null {
    try {
      const encrypted = localStorage.getItem(this.STORAGE_KEY);
      if (!encrypted) return null;
      
      // Decrypt (in a real implementation, use proper decryption)
      const keys = JSON.parse(atob(encrypted));
      return keys[provider] || null;
    } catch (error) {
      console.error('Failed to retrieve API key:', error);
      return null;
    }
  }

  // Get all stored API keys
  static getAllApiKeys(): Record<string, ApiKeyConfig> {
    try {
      const encrypted = localStorage.getItem(this.STORAGE_KEY);
      if (!encrypted) return {};
      
      // Decrypt (in a real implementation, use proper decryption)
      return JSON.parse(atob(encrypted));
    } catch (error) {
      console.error('Failed to retrieve API keys:', error);
      return {};
    }
  }

  // Remove API key for specific provider
  static removeApiKey(provider: 'openrouter' | 'gemini'): void {
    try {
      const existingKeys = this.getAllApiKeys();
      delete existingKeys[provider];
      
      const encrypted = btoa(JSON.stringify(existingKeys));
      localStorage.setItem(this.STORAGE_KEY, encrypted);
      
      console.log(`API key removed for ${provider}`);
    } catch (error) {
      console.error('Failed to remove API key:', error);
    }
  }

  // Clear all API keys
  static clearAllApiKeys(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(this.VALIDATION_CACHE_KEY);
      console.log('All API keys cleared');
    } catch (error) {
      console.error('Failed to clear API keys:', error);
    }
  }

  // Validate API key format
  static validateApiKeyFormat(apiKey: string, provider: 'openrouter' | 'gemini'): { isValid: boolean; error?: string } {
    if (!apiKey || apiKey.trim().length === 0) {
      return { isValid: false, error: 'API key cannot be empty' };
    }

    switch (provider) {
      case 'openrouter':
        // OpenRouter keys typically start with 'sk-or-v1-'
        if (!apiKey.startsWith('sk-or-v1-')) {
          return { isValid: false, error: 'Invalid OpenRouter API key format' };
        }
        if (apiKey.length < 20) {
          return { isValid: false, error: 'OpenRouter API key too short' };
        }
        break;
      
      case 'gemini':
        // Gemini keys typically start with specific patterns
        if (apiKey.length < 20) {
          return { isValid: false, error: 'Gemini API key too short' };
        }
        break;
    }

    return { isValid: true };
  }

  // Validate API key by making test request
  static async validateApiKey(
    apiKey: string, 
    provider: 'openrouter' | 'gemini'
  ): Promise<ApiKeyValidationResult> {
    // Check cache first
    const cached = this.getCachedValidation(apiKey, provider);
    if (cached) {
      return cached;
    }

    try {
      let isValid = false;
      let error: string | undefined;

      switch (provider) {
        case 'openrouter':
          const { getOpenRouterClient } = await import('../api/openRouterClient');
          const client = getOpenRouterClient(apiKey);
          isValid = await client.validateApiKey();
          if (!isValid) {
            error = 'OpenRouter API key validation failed';
          }
          break;
        
        case 'gemini':
          // For Gemini, we'd validate against Google's API
          // For now, just check format
          const formatValidation = this.validateApiKeyFormat(apiKey, provider);
          isValid = formatValidation.isValid;
          error = formatValidation.error;
          break;
      }

      const result: ApiKeyValidationResult = {
        isValid,
        provider,
        error,
        lastValidated: new Date(),
        usage: this.getUsageEstimate(provider)
      };

      // Cache the result
      this.cacheValidation(apiKey, provider, result);
      
      return result;
    } catch (error) {
      const result: ApiKeyValidationResult = {
        isValid: false,
        provider,
        error: error instanceof Error ? error.message : 'Validation failed',
        lastValidated: new Date()
      };
      
      this.cacheValidation(apiKey, provider, result);
      return result;
    }
  }

  // Get cached validation result
  private static getCachedValidation(
    apiKey: string, 
    provider: 'openrouter' | 'gemini'
  ): ApiKeyValidationResult | null {
    try {
      const cacheKey = `${provider}_${apiKey.substring(0, 10)}`;
      const cached = localStorage.getItem(`${this.VALIDATION_CACHE_KEY}_${cacheKey}`);
      
      if (!cached) return null;
      
      const cachedResult = JSON.parse(cached);
      const now = new Date().getTime();
      
      // Check if cache is still valid
      if (now - cachedResult.timestamp < this.CACHE_DURATION) {
        return {
          ...cachedResult.result,
          lastValidated: new Date(cachedResult.timestamp)
        };
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get cached validation:', error);
      return null;
    }
  }

  // Cache validation result
  private static cacheValidation(
    apiKey: string, 
    provider: 'openrouter' | 'gemini', 
    result: ApiKeyValidationResult
  ): void {
    try {
      const cacheKey = `${provider}_${apiKey.substring(0, 10)}`;
      const cacheData = {
        result,
        timestamp: new Date().getTime()
      };
      
      localStorage.setItem(
        `${this.VALIDATION_CACHE_KEY}_${cacheKey}`,
        JSON.stringify(cacheData)
      );
    } catch (error) {
      console.error('Failed to cache validation:', error);
    }
  }

  // Get usage estimate for provider
  private static getUsageEstimate(provider: 'openrouter' | 'gemini'): { daily: number; monthly: number } {
    // In a real implementation, this would fetch actual usage
    // For now, return estimates
    switch (provider) {
      case 'openrouter':
        return { daily: 5, monthly: 50 }; // $5 daily, $50 monthly
      case 'gemini':
        return { daily: 10, monthly: 100 }; // $10 daily, $100 monthly
      default:
        return { daily: 0, monthly: 0 };
    }
  }

  // Check if API key is approaching usage limits
  static checkUsageLimits(provider: 'openrouter' | 'gemini'): { isNearLimit: boolean; remainingUsage: number } {
    const usage = this.getUsageEstimate(provider);
    const dailyLimit = provider === 'openrouter' ? 10 : 20; // $10 for OpenRouter, $20 for Gemini
    const monthlyLimit = provider === 'openrouter' ? 100 : 200; // $100 for OpenRouter, $200 for Gemini
    
    const isNearLimit = usage.daily > (dailyLimit * 0.8); // 80% of daily limit
    const remainingUsage = Math.max(0, dailyLimit - usage.daily);
    
    return { isNearLimit, remainingUsage };
  }

  // Get API key status
  static getApiKeyStatus(provider: 'openrouter' | 'gemini'): {
    hasKey: boolean;
    isValid: boolean;
    lastValidated?: Date;
    isNearLimit: boolean;
  } {
    const config = this.getApiKey(provider);
    const hasKey = !!config;
    
    if (!hasKey) {
      return {
        hasKey: false,
        isValid: false,
        isNearLimit: false
      };
    }

    const cached = this.getCachedValidation(config.apiKey, provider);
    const isValid = cached ? cached.isValid : false;
    const lastValidated = cached ? cached.lastValidated : undefined;
    const usageCheck = this.checkUsageLimits(provider);
    
    return {
      hasKey: true,
      isValid,
      lastValidated,
      isNearLimit: usageCheck.isNearLimit
    };
  }

  // Refresh API key validation
  static async refreshValidation(provider: 'openrouter' | 'gemini'): Promise<ApiKeyValidationResult | null> {
    const config = this.getApiKey(provider);
    if (!config) return null;
    
    // Clear cache for this key
    const cacheKey = `${provider}_${config.apiKey.substring(0, 10)}`;
    localStorage.removeItem(`${this.VALIDATION_CACHE_KEY}_${cacheKey}`);
    
    // Re-validate
    return await this.validateApiKey(config.apiKey, provider);
  }

  // Export API keys (for backup)
  static exportApiKeys(): string {
    try {
      const keys = this.getAllApiKeys();
      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        keys: Object.entries(keys).map(([provider, config]) => ({
          provider,
          hasKey: true,
          lastValidated: config.lastValidated,
          isValid: config.isValid
        }))
      };
      
      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('Failed to export API keys:', error);
      return '{}';
    }
  }

  // Import API keys (from backup)
  static importApiKeys(exportData: string): { success: boolean; imported: string[]; errors: string[] } {
    try {
      const data = JSON.parse(exportData);
      const imported: string[] = [];
      const errors: string[] = [];
      
      if (!data.keys || !Array.isArray(data.keys)) {
        return { success: false, imported: [], errors: ['Invalid export data format'] };
      }
      
      for (const keyData of data.keys) {
        try {
          if (!keyData.provider || !keyData.hasKey) {
            errors.push(`Invalid key data for ${keyData.provider}`);
            continue;
          }
          
          // Note: In a real implementation, we'd need the actual API key
          // This is just for metadata import/export
          imported.push(keyData.provider);
        } catch (error) {
          errors.push(`Failed to import ${keyData.provider}: ${error}`);
        }
      }
      
      return {
        success: errors.length === 0,
        imported,
        errors
      };
    } catch (error) {
      return {
        success: false,
        imported: [],
        errors: [`Import failed: ${error}`]
      };
    }
  }
}