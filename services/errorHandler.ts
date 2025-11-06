// Centralized error handling service
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorType {
  USER_INPUT = 'user_input',
  NETWORK = 'network',
  SYSTEM = 'system',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  UNKNOWN = 'unknown'
}

export interface AppError {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  userMessage: string;
  technicalDetails: string;
  timestamp: Date;
  context?: Record<string, any>;
  stackTrace?: string;
}

// Environment detection
const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

// Create a safe error ID for logging
const generateErrorId = (): string => {
  return `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: AppError[] = [];

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  // Sanitize error details for user display
  private sanitizeForUser(error: Error | string, type: ErrorType): string {
    const errorMessage = error instanceof Error ? error.message : error;
    
    // Define safe user messages by error type
    const userMessages: Record<ErrorType, string> = {
      [ErrorType.USER_INPUT]: 'Please check your input and try again.',
      [ErrorType.NETWORK]: 'A network error occurred. Please check your connection and try again.',
      [ErrorType.SYSTEM]: 'A system error occurred. Please try again later.',
      [ErrorType.VALIDATION]: 'The provided data is invalid. Please review and correct your input.',
      [ErrorType.AUTHENTICATION]: 'Authentication failed. Please check your credentials and try again.',
      [ErrorType.UNKNOWN]: 'An unexpected error occurred. Please try again later.'
    };

    return userMessages[type] || userMessages[ErrorType.UNKNOWN];
  }

  // Handle errors with proper sanitization
  handleError(
    error: Error | string,
    type: ErrorType = ErrorType.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context?: Record<string, any>
  ): AppError {
    const errorId = generateErrorId();
    const sanitizedMessage = this.sanitizeForUser(error, type);
    
    // Create error object with all details
    const appError: AppError = {
      id: errorId,
      type,
      severity,
      userMessage: sanitizedMessage,
      technicalDetails: error instanceof Error ? error.message : error,
      timestamp: new Date(),
      context,
      stackTrace: error instanceof Error ? error.stack : undefined
    };

    // Log detailed information only in development
    if (isDevelopment) {
      console.error(`[${errorId}] ${type.toUpperCase()} ERROR:`, {
        message: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : 'No stack trace',
        context,
        severity,
        timestamp: appError.timestamp.toISOString()
      });
    } else {
      // In production, only log to our internal error log (no console)
      this.logToServer(appError);
    }

    // Store error for potential reporting
    this.errorLog.push(appError);

    // Keep only last 50 errors to prevent memory issues
    if (this.errorLog.length > 50) {
      this.errorLog = this.errorLog.slice(-50);
    }

    return appError;
  }

  // Log error to server (implement your server logging here)
  private logToServer(error: AppError): void {
    // In a real application, you would send this to your logging service
    // For now, we'll just store it locally
    if (isProduction) {
      // Avoid any potential information disclosure
      // In production, send to secure logging service
      this.sendToLoggingService(error).catch(() => {
        // Silently fail - don't throw additional errors
      });
    }
  }

  // Simulated logging service (replace with actual implementation)
  private async sendToLoggingService(error: AppError): Promise<void> {
    // This would be your actual logging service endpoint
    // Example: await fetch('/api/errors', { method: 'POST', body: JSON.stringify(error) });
    
    // For now, just simulate the network call
    return new Promise((resolve) => {
      setTimeout(() => resolve(), 100);
    });
  }

  // Get user-friendly error message
  getUserMessage(error: AppError): string {
    return error.userMessage;
  }

  // Get error by ID (for debugging)
  getError(errorId: string): AppError | undefined {
    return this.errorLog.find(e => e.id === errorId);
  }

  // Clear error log (for testing or memory management)
  clearErrorLog(): void {
    this.errorLog = [];
  }

  // Get all errors (for debugging/analytics)
  getAllErrors(): AppError[] {
    return [...this.errorLog];
  }

  // Create a safe error response for API calls
  createSafeErrorResponse(error: AppError, originalError?: Error | string) {
    return {
      success: false,
      error: {
        message: this.getUserMessage(error),
        id: error.id,
        type: error.type
      },
      // Only include additional details in development
      ...(isDevelopment && {
        technicalDetails: originalError instanceof Error ? originalError.message : originalError,
        stack: originalError instanceof Error ? originalError.stack : undefined,
        context: error.context
      })
    };
  }

  // Wrap async functions to handle errors safely
  async safeExecute<T>(
    operation: () => Promise<T>,
    errorType: ErrorType = ErrorType.UNKNOWN,
    context?: Record<string, any>
  ): Promise<{ success: true; data: T } | { success: false; error: AppError }> {
    try {
      const data = await operation();
      return { success: true, data };
    } catch (error) {
      const appError = this.handleError(
        error instanceof Error ? error : new Error(String(error)),
        errorType,
        ErrorSeverity.MEDIUM,
        context
      );
      return { success: false, error: appError };
    }
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Helper functions for common error patterns
export const createNetworkError = (message: string) => 
  errorHandler.handleError(message, ErrorType.NETWORK, ErrorSeverity.MEDIUM);

export const createValidationError = (message: string, context?: Record<string, any>) =>
  errorHandler.handleError(message, ErrorType.VALIDATION, ErrorSeverity.LOW, context);

export const createSystemError = (message: string, context?: Record<string, any>) =>
  errorHandler.handleError(message, ErrorType.SYSTEM, ErrorSeverity.HIGH, context);

export const createUserInputError = (message: string, context?: Record<string, any>) =>
  errorHandler.handleError(message, ErrorType.USER_INPUT, ErrorSeverity.LOW, context);