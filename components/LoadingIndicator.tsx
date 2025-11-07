import React from 'react';

interface LoadingIndicatorProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
  showProgress?: boolean;
  progress?: number;
  className?: string;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  size = 'medium',
  message,
  showProgress = false,
  progress = 0,
  className = ''
}) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  };

  const textSizes = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base'
  };

  return (
    <div className={`flex flex-col items-center justify-center space-y-2 ${className}`}>
      {/* Spinner */}
      <div className={`${sizeClasses[size]} relative`}>
        <div className="absolute inset-0 border-2 border-gray-200 rounded-full"></div>
        <div className="absolute inset-0 border-2 border-blue-600 rounded-full border-t-transparent border-r-transparent animate-spin"></div>
      </div>

      {/* Progress Bar */}
      {showProgress && (
        <div className="w-full max-w-xs">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1 text-center">
            {progress.toFixed(0)}% complete
          </div>
        </div>
      )}

      {/* Message */}
      {message && (
        <div className={`${textSizes[size]} text-gray-600 text-center max-w-xs`}>
          {message}
        </div>
      )}

      {/* Processing Steps */}
      {!showProgress && !message && (
        <div className="text-xs text-gray-500 text-center space-y-1">
          <div>🔍 Analyzing with AI...</div>
          <div>📊 Processing financial data...</div>
          <div>⚡ Optimizing results...</div>
        </div>
      )}
    </div>
  );
};

// Full screen loading overlay
export const FullScreenLoading: React.FC<LoadingIndicatorProps & {
  overlay?: boolean;
}> = ({
  overlay = true,
  ...props
}) => {
  if (!overlay) {
    return <LoadingIndicator {...props} />;
  }

  return (
    <div className="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
      <LoadingIndicator {...props} />
    </div>
  );
};

// Inline loading for buttons
export const ButtonLoading: React.FC<{
  size?: 'small' | 'medium';
  className?: string;
}> = ({ size = 'small', className = '' }) => {
  const sizeClasses = {
    small: 'w-3 h-3',
    medium: 'w-4 h-4'
  };

  return (
    <div className={`${sizeClasses[size]} relative inline-block ${className}`}>
      <div className="absolute inset-0 border-2 border-gray-200 rounded-full"></div>
      <div className="absolute inset-0 border-2 border-white rounded-full border-t-transparent border-r-transparent animate-spin"></div>
    </div>
  );
};

// Step-by-step loading indicator
export interface StepLoadingProps {
  steps: string[];
  currentStep: number;
  className?: string;
}

export const StepLoading: React.FC<StepLoadingProps> = ({
  steps,
  currentStep,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center space-y-3 ${className}`}>
      <div className="w-full max-w-md">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center space-x-3">
            {/* Step Circle */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
              index < currentStep
                ? 'bg-blue-600 text-white'
                : index === currentStep
                ? 'bg-blue-100 text-blue-600 border-2 border-blue-600'
                : 'bg-gray-200 text-gray-500'
            }`}>
              {index < currentStep ? '✓' : index + 1}
            </div>
            
            {/* Step Text */}
            <div className={`flex-1 text-sm ${
              index <= currentStep ? 'text-gray-900' : 'text-gray-400'
            }`}>
              {step}
            </div>
          </div>
        ))}
      </div>
      
      {/* Progress Bar */}
      <div className="w-full max-w-md mt-2">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${(currentStep / steps.length) * 100}%` }}
          />
        </div>
        <div className="text-xs text-gray-500 mt-1 text-center">
          Step {currentStep} of {steps.length}
        </div>
      </div>
    </div>
  );
};

// Model-specific loading indicators
export const ModelLoading: React.FC<{
  model: string;
  task: string;
  className?: string;
}> = ({ model, task, className = '' }) => {
  const getModelIcon = (modelName: string): string => {
    if (modelName.includes('nemotron')) return '🧠';
    if (modelName.includes('gemini')) return '💎';
    if (modelName.includes('grok')) return '🚀';
    if (modelName.includes('elevenlabs')) return '🔊';
    return '🤖';
  };

  const getTaskDescription = (taskName: string): string => {
    switch (taskName) {
      case 'ocr': return 'Extracting text from document...';
      case 'analysis': return 'Analyzing financial data...';
      case 'generation': return 'Generating financial report...';
      case 'correction': return 'Validating calculations...';
      case 'audio': return 'Generating audio summary...';
      default: return 'Processing...';
    }
  };

  return (
    <div className={`flex flex-col items-center space-y-3 ${className}`}>
      <div className="text-4xl animate-pulse">
        {getModelIcon(model)}
      </div>
      
      <div className="text-center">
        <div className="font-medium text-gray-900">{model}</div>
        <div className="text-sm text-gray-600">{getTaskDescription(task)}</div>
      </div>
      
      <div className="w-full max-w-xs">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
        </div>
      </div>
    </div>
  );
};

// Cost-aware loading indicator
export const CostLoading: React.FC<{
  estimatedCost: number;
  currentCost?: number;
  model: string;
  className?: string;
}> = ({ estimatedCost, currentCost = 0, model, className = '' }) => {
  const costPercentage = (currentCost / estimatedCost) * 100;
  
  return (
    <div className={`flex flex-col items-center space-y-2 ${className}`}>
      <div className="text-sm text-gray-600">
        Processing with {model}
      </div>
      
      <div className="w-full max-w-xs">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Cost: ${currentCost.toFixed(4)}</span>
          <span>Estimate: ${estimatedCost.toFixed(4)}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-green-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, costPercentage)}%` }}
          />
        </div>
      </div>
      
      <div className="text-xs text-gray-500">
        {costPercentage < 50 ? 'Low cost usage' :
         costPercentage < 80 ? 'Moderate cost usage' :
         'High cost usage - consider optimizing'}
      </div>
    </div>
  );
};