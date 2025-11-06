// Secure logging utility
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

class Logger {
  private static instance: Logger;

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    if (isProduction) {
      // In production, only log warnings and errors
      return level === LogLevel.WARN || level === LogLevel.ERROR;
    }
    // In development, log everything
    return true;
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (args.length > 0) {
      return `${formattedMessage} ${JSON.stringify(args, null, 2)}`;
    }
    return formattedMessage;
  }

  private sanitizeArgs(...args: any[]): any[] {
    // Remove potentially sensitive information from logs in production
    if (isProduction) {
      return args.map(arg => {
        if (typeof arg === 'object') {
          // Create a sanitized version of the object
          const sanitized = { ...arg };
          
          // Remove sensitive fields
          const sensitiveFields = ['password', 'token', 'key', 'secret', 'apiKey', 'auth', 'credential'];
          sensitiveFields.forEach(field => {
            if (field in sanitized) {
              sanitized[field] = '[REDACTED]';
            }
          });
          
          return sanitized;
        }
        return arg;
      });
    }
    return args;
  }

  error(message: string, ...args: any[]): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    
    // In production, don't expose detailed error information
    if (isProduction) {
      // Log to secure logging service instead of console
      this.logToSecureService(LogLevel.ERROR, message, args);
      return;
    }
    
    console.error(this.formatMessage(LogLevel.ERROR, message, ...this.sanitizeArgs(args)));
  }

  warn(message: string, ...args: any[]): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    
    if (isProduction) {
      this.logToSecureService(LogLevel.WARN, message, args);
      return;
    }
    
    console.warn(this.formatMessage(LogLevel.WARN, message, ...this.sanitizeArgs(args)));
  }

  info(message: string, ...args: any[]): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    
    if (isProduction) {
      this.logToSecureService(LogLevel.INFO, message, args);
      return;
    }
    
    console.info(this.formatMessage(LogLevel.INFO, message, ...this.sanitizeArgs(args)));
  }

  debug(message: string, ...args: any[]): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    
    if (isProduction) {
      // Never log debug messages in production
      return;
    }
    
    console.debug(this.formatMessage(LogLevel.DEBUG, message, ...this.sanitizeArgs(args)));
  }

  private async logToSecureService(level: LogLevel, message: string, args: any[]): Promise<void> {
    // In a real application, send to secure logging service
    // For now, we'll just prepare the log data
    const logData = {
      level,
      message,
      timestamp: new Date().toISOString(),
      args: this.sanitizeArgs(args),
      environment: isProduction ? 'production' : 'development'
    };

    // You would send this to your logging service
    // Example: await fetch('/api/logs', { method: 'POST', body: JSON.stringify(logData) });
  }

  // Group related logs (development only)
  group(label: string): void {
    if (isProduction) return;
    console.group(label);
  }

  groupEnd(): void {
    if (isProduction) return;
    console.groupEnd();
  }

  // Time operations (development only)
  time(label: string): void {
    if (isProduction) return;
    console.time(label);
  }

  timeEnd(label: string): void {
    if (isProduction) return;
    console.timeEnd(label);
  }
}

export const logger = Logger.getInstance();

// Convenience methods
export const logError = (message: string, ...args: any[]) => logger.error(message, ...args);
export const logWarn = (message: string, ...args: any[]) => logger.warn(message, ...args);
export const logInfo = (message: string, ...args: any[]) => logger.info(message, ...args);
export const logDebug = (message: string, ...args: any[]) => logger.debug(message, ...args);