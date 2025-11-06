import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { logger } from './utils/logger';
import ErrorBoundary from './components/ErrorBoundary';

// Add global error handlers to catch unhandled errors
window.addEventListener('error', (event) => {
  logger.error('Unhandled global error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error ? event.error.message : 'No error object'
  });
});

window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection', {
    reason: event.reason instanceof Error ? event.reason.message : String(event.reason),
    promise: event.promise
  });
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  logger.error('Root element not found - application cannot start');
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  
  // Log application start (only in development)
  logger.info('Application starting up', {
    userAgent: navigator.userAgent.substring(0, 100), // Truncate for privacy
    timestamp: new Date().toISOString()
  });
  
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
} catch (error) {
  logger.error('Failed to initialize React application', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined
  });
  
  // Fallback error display
  rootElement.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f3f4f6; font-family: system-ui, sans-serif;">
      <div style="max-width: 500px; padding: 2rem; background: white; border-radius: 0.5rem; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); text-align: center;">
        <h1 style="color: #dc2626; font-size: 1.5rem; margin-bottom: 1rem;">Application Error</h1>
        <p style="color: #6b7280; margin-bottom: 1.5rem;">The application failed to start. Please refresh the page or try again later.</p>
        <button onclick="window.location.reload()" style="background: #2563eb; color: white; padding: 0.75rem 1.5rem; border: none; border-radius: 0.5rem; cursor: pointer; font-weight: 600;">
          Refresh Page
        </button>
      </div>
    </div>
  `;
}