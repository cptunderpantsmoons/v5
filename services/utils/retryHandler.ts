export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryableErrors?: string[];
  onRetry?: (attempt: number, error: any) => void;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: any;
  attempts: number;
}

export class RetryHandler {
  private static readonly DEFAULT_OPTIONS: Required<RetryOptions> = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
    retryableErrors: [
      'ECONNRESET',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'EHOSTUNREACH',
      'EPIPE',
      'ENOTFOUND',
      'EAI_AGAIN',
      '429', // Rate limit
      '500', // Server error
      '502', // Bad gateway
      '503', // Service unavailable
      '504'  // Gateway timeout
    ],
    onRetry: () => {}
  };

  static async execute<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<RetryResult<T>> {
    const config = { ...this.DEFAULT_OPTIONS, ...options };
    let lastError: any;
    
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        const data = await operation();
        return {
          success: true,
          data,
          attempts: attempt + 1
        };
      } catch (error) {
        lastError = error;
        
        // Check if error is retryable
        if (!this.isRetryableError(error, config) || attempt === config.maxRetries) {
          break;
        }
        
        // Call retry callback if provided
        config.onRetry(attempt + 1, error);
        
        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt, config);
        await this.sleep(delay);
      }
    }
    
    return {
      success: false,
      error: lastError,
      attempts: config.maxRetries + 1
    };
  }

  static async executeWithExponentialBackoff<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<RetryResult<T>> {
    const config = { ...this.DEFAULT_OPTIONS, ...options };
    let lastError: any;
    
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        const data = await operation();
        return {
          success: true,
          data,
          attempts: attempt + 1
        };
      } catch (error) {
        lastError = error;
        
        // Check if error is retryable
        if (!this.isRetryableError(error, config) || attempt === config.maxRetries) {
          break;
        }
        
        // Call retry callback if provided
        config.onRetry(attempt + 1, error);
        
        // Calculate exponential backoff delay
        const delay = this.calculateExponentialDelay(attempt, config);
        await this.sleep(delay);
      }
    }
    
    return {
      success: false,
      error: lastError,
      attempts: config.maxRetries + 1
    };
  }

  private static isRetryableError(error: any, config: Required<RetryOptions>): boolean {
    // Check for network errors
    if (error.code && config.retryableErrors.includes(error.code)) {
      return true;
    }
    
    // Check for HTTP status errors
    if (error.status && config.retryableErrors.includes(error.status.toString())) {
      return true;
    }
    
    // Check for specific error messages
    if (error.message) {
      const retryableMessages = [
        'Network Error',
        'timeout',
        'rate limit',
        'too many requests',
        'service unavailable',
        'temporary failure'
      ];
      
      return retryableMessages.some(msg => 
        error.message.toLowerCase().includes(msg)
      );
    }
    
    return false;
  }

  private static calculateDelay(attempt: number, config: Required<RetryOptions>): number {
    // Linear backoff
    const delay = config.baseDelay * Math.pow(config.backoffFactor, attempt);
    return Math.min(delay, config.maxDelay);
  }

  private static calculateExponentialDelay(attempt: number, config: Required<RetryOptions>): number {
    // Exponential backoff with jitter
    const exponentialDelay = config.baseDelay * Math.pow(config.backoffFactor, attempt);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, config.maxDelay);
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Specialized retry handlers for different scenarios
export class ApiRetryHandler {
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string,
    options: RetryOptions = {}
  ): Promise<T> {
    console.log(`Executing ${context} with retry logic...`);
    
    const result = await RetryHandler.executeWithExponentialBackoff(operation, {
      ...options,
      onRetry: (attempt, error) => {
        console.warn(`${context} attempt ${attempt} failed:`, error.message || error);
      }
    });
    
    if (!result.success) {
      console.error(`${context} failed after ${result.attempts} attempts:`, result.error);
      throw result.error;
    }
    
    console.log(`${context} succeeded on attempt ${result.attempts}`);
    return result.data;
  }

  static async executeApiCall<T>(
    operation: () => Promise<T>,
    apiName: string,
    options: RetryOptions = {}
  ): Promise<T> {
    return this.executeWithRetry(operation, `API call to ${apiName}`, {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      ...options
    });
  }

  static async executeFileOperation<T>(
    operation: () => Promise<T>,
    fileName: string,
    options: RetryOptions = {}
  ): Promise<T> {
    return this.executeWithRetry(operation, `File operation on ${fileName}`, {
      maxRetries: 2,
      baseDelay: 500,
      maxDelay: 5000,
      ...options
    });
  }
}

// Circuit breaker pattern for handling cascading failures
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 60000, // 1 minute
    private resetTimeout: number = 30000 // 30 seconds
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      throw new Error('Circuit breaker is OPEN - operation blocked');
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      
      // Auto-reset after timeout
      setTimeout(() => {
        if (this.state === 'OPEN') {
          this.state = 'HALF_OPEN';
        }
      }, this.resetTimeout);
    }
  }

  getState(): string {
    return this.state;
  }

  reset(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }
}

// Error classification and handling utilities
export class ErrorHandler {
  static classifyError(error: any): {
    type: 'network' | 'api' | 'validation' | 'timeout' | 'unknown';
    retryable: boolean;
    userMessage: string;
  } {
    // Network errors
    if (error.code === 'ECONNRESET' || 
        error.code === 'ETIMEDOUT' || 
        error.code === 'ECONNREFUSED' ||
        error.name === 'NetworkError') {
      return {
        type: 'network',
        retryable: true,
        userMessage: 'Network connection error. Please check your internet connection.'
      };
    }
    
    // Timeout errors
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      return {
        type: 'timeout',
        retryable: true,
        userMessage: 'Request timed out. Please try again.'
      };
    }
    
    // API errors
    if (error.status) {
      const retryableStatuses = [429, 500, 502, 503, 504];
      return {
        type: 'api',
        retryable: retryableStatuses.includes(error.status),
        userMessage: this.getApiErrorMessage(error)
      };
    }
    
    // Validation errors
    if (error.message?.includes('validation') || 
        error.message?.includes('invalid') ||
        error.type === 'validation') {
      return {
        type: 'validation',
        retryable: false,
        userMessage: error.message || 'Invalid input provided.'
      };
    }
    
    // Unknown errors
    return {
      type: 'unknown',
      retryable: false,
      userMessage: error.message || 'An unexpected error occurred.'
    };
  }

  private static getApiErrorMessage(error: any): string {
    const statusMessages: Record<number, string> = {
      400: 'Bad request. Please check your input.',
      401: 'Authentication failed. Please check your API key.',
      403: 'Access forbidden. You do not have permission.',
      404: 'Resource not found.',
      429: 'Too many requests. Please wait and try again.',
      500: 'Server error. Please try again later.',
      502: 'Service temporarily unavailable.',
      503: 'Service maintenance in progress.',
      504: 'Request timeout. Please try again.'
    };
    
    return statusMessages[error.status] || `API error: ${error.status}`;
  }

  static createUserFriendlyMessage(error: any): string {
    const classification = this.classifyError(error);
    return classification.userMessage;
  }
}