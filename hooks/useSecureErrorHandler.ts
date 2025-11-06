import { useCallback } from 'react';
import { errorHandler, ErrorType, AppError, ErrorSeverity } from '../services/errorHandler';

interface UseSecureErrorHandlerOptions {
  onError?: (error: AppError) => void;
  showToast?: boolean;
  context?: Record<string, any>;
}

export const useSecureErrorHandler = (options: UseSecureErrorHandlerOptions = {}) => {
  const { onError, showToast = false, context } = options;

  const handleError = useCallback((
    error: Error | string,
    type: ErrorType = ErrorType.UNKNOWN,
    options?: {
      showToast?: boolean;
      context?: Record<string, any>;
    }
  ) => {
    const { showToast: shouldShowToast = showToast, context: errorContext = context } = options || {};
    
    const appError = errorHandler.handleError(
      error,
      type,
      ErrorSeverity.MEDIUM,
      errorContext
    );

    if (onError) {
      onError(appError);
    }

    // In a real app, you might show a toast notification here
    // but only show the safe user message
    if (shouldShowToast) {
      // This would integrate with your toast notification system
      // showToast(errorHandler.getUserMessage(appError), 'error');
    }

    return appError;
  }, [onError, showToast, context]);

  const handleAsyncError = useCallback(async <T>(
    operation: () => Promise<T>,
    type: ErrorType = ErrorType.UNKNOWN,
    options?: {
      showToast?: boolean;
      context?: Record<string, any>;
    }
  ): Promise<{ success: true; data: T } | { success: false; error: AppError }> => {
    return errorHandler.safeExecute(operation, type, context);
  }, [context]);

  return {
    handleError,
    handleAsyncError,
    getUserMessage: errorHandler.getUserMessage.bind(errorHandler)
  };
};