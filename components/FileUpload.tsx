import React, { useState, useRef, useCallback } from 'react';
import { ApiKeyManager } from '../services/utils/apiKeyManager';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  acceptedTypes?: string[];
  maxSize?: number; // in MB
  disabled?: boolean;
  className?: string;
}

interface FileValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  acceptedTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.xlsx', '.xls'],
  maxSize = 10, // 10MB default
  disabled = false,
  className = ''
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [validationResult, setValidationResult] = useState<FileValidationResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): FileValidationResult => {
    const warnings: string[] = [];
    
    // Check file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedTypes.includes(fileExtension)) {
      return {
        isValid: false,
        error: `File type ${fileExtension} is not supported. Accepted types: ${acceptedTypes.join(', ')}`
      };
    }

    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSize) {
      return {
        isValid: false,
        error: `File size ${fileSizeMB.toFixed(2)}MB exceeds maximum size of ${maxSize}MB`
      };
    }

    // Check for potential issues
    if (fileSizeMB > 5) {
      warnings.push('Large files may take longer to process');
    }

    if (file.name.length > 100) {
      warnings.push('Long filename may cause processing issues');
    }

    // Check if file is password protected (for PDFs)
    if (file.type === 'application/pdf' && file.size > 1024) {
      // This is a basic check - in a real implementation, you'd use a PDF library
      warnings.push('Ensure PDF is not password protected');
    }

    return {
      isValid: true,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }, [acceptedTypes, maxSize]);

  const handleFile = useCallback((file: File) => {
    if (disabled) return;

    const validation = validateFile(file);
    setValidationResult(validation);

    if (validation.isValid) {
      onFileSelect(file);
    }
  }, [disabled, onFileSelect, validateFile]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [disabled, handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const openFileDialog = useCallback(() => {
    if (disabled || !fileInputRef.current) return;
    fileInputRef.current.click();
  }, [disabled]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf': return '📄';
      case 'jpg':
      case 'jpeg':
      case 'png': return '🖼️';
      case 'xlsx':
      case 'xls': return '📊';
      default: return '📁';
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={openFileDialog}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          onChange={handleFileInput}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="text-4xl">
            {isDragging ? '📥' : '📤'}
          </div>
          
          <div className="text-lg font-medium">
            {isDragging ? 'Drop file here' : 'Drag & drop file here'}
          </div>
          
          <div className="text-sm text-gray-500">
            or click to browse
          </div>
          
          <div className="text-xs text-gray-400 mt-2">
            Accepted: {acceptedTypes.join(', ')}
          </div>
          
          <div className="text-xs text-gray-400">
            Max size: {maxSize}MB
          </div>
        </div>
      </div>

      {/* Validation Results */}
      {validationResult && (
        <div className={`mt-2 p-2 rounded text-sm ${
          validationResult.isValid
            ? 'bg-green-100 text-green-800'
            : 'bg-red-100 text-red-800'
        }`}>
          {validationResult.isValid ? (
            <div>
              <span className="font-medium">✓ File is valid</span>
              {validationResult.warnings && (
                <div className="mt-1">
                  {validationResult.warnings.map((warning, index) => (
                    <div key={index} className="text-yellow-700">
                      ⚠️ {warning}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <span className="font-medium">✗ {validationResult.error}</span>
            </div>
          )}
        </div>
      )}

      {/* File Info Display */}
      {validationResult?.isValid && (
        <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
          <div className="font-medium">File ready for processing</div>
          <div className="text-xs text-gray-500 mt-1">
            Processing will use optimized model selection based on file type and content
          </div>
        </div>
      )}
    </div>
  );
};

// File upload with progress indicator
export const FileUploadWithProgress: React.FC<FileUploadProps & {
  onProgress?: (progress: number) => void;
  processing?: boolean;
}> = ({
  onFileSelect,
  onProgress,
  processing = false,
  ...props
}) => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    onFileSelect(file);
    
    // Simulate upload progress
    if (onProgress) {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 20;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
        }
        onProgress(progress);
        setUploadProgress(progress);
      }, 200);
    }
  }, [onFileSelect, onProgress]);

  return (
    <div className="w-full">
      <FileUpload
        {...props}
        onFileSelect={handleFileSelect}
        disabled={processing}
        className={processing ? 'opacity-50' : ''}
      />
      
      {selectedFile && (
        <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-lg">
                {selectedFile.name.split('.').pop()?.toLowerCase() === 'pdf' ? '📄' : '📊'}
              </span>
              <span className="font-medium">{selectedFile.name}</span>
              <span className="text-gray-500">
                ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
              </span>
            </div>
            
            {processing && (
              <div className="text-blue-600 text-sm">
                Processing...
              </div>
            )}
          </div>
          
          {/* Progress Bar */}
          {(uploadProgress > 0 || processing) && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {uploadProgress.toFixed(0)}% uploaded
              </div>
            </div>
          )}
          
          {/* Processing Status */}
          {processing && (
            <div className="mt-2 text-xs text-blue-600">
              <div>🔍 Analyzing document with AI models...</div>
              <div>📊 Extracting financial data...</div>
              <div>⚡ Optimizing model selection...</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Advanced file upload with model selection preview
export const AdvancedFileUpload: React.FC<FileUploadProps & {
  onModelSelection?: (models: string[]) => void;
  showModelPreview?: boolean;
}> = ({
  onFileSelect,
  onModelSelection,
  showModelPreview = false,
  ...props
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [modelPreview, setModelPreview] = useState<string[]>([]);

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    onFileSelect(file);
    
    // Get model selection preview
    if (showModelPreview && onModelSelection) {
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      const models = getModelSelectionForFile(fileExtension);
      setModelPreview(models);
      onModelSelection(models);
    }
  }, [onFileSelect, onModelSelection, showModelPreview]);

  const getModelSelectionForFile = (fileExtension: string): string[] => {
    switch (fileExtension) {
      case '.pdf':
      case '.jpg':
      case '.jpeg':
      case '.png':
        return [
          'NVIDIA Nemotron Nano 12B 2 VL (OCR - FREE)',
          'Google Gemini 2.0 Flash (Correction - FREE)',
          'xAI Grok 4 Fast (Analysis - $0.20/M input)'
        ];
      case '.xlsx':
      case '.xls':
        return [
          'xAI Grok 4 Fast (Analysis - $0.20/M input)',
          'Google Gemini 2.0 Flash (Processing - FREE)'
        ];
      default:
        return ['Google Gemini 2.0 Flash (General - FREE)'];
    }
  };

  return (
    <div className="w-full">
      <FileUpload
        {...props}
        onFileSelect={handleFileSelect}
      />
      
      {selectedFile && showModelPreview && modelPreview.length > 0 && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <h3 className="text-sm font-medium text-blue-900 mb-2">
            Optimized Model Selection
          </h3>
          <div className="space-y-1">
            {modelPreview.map((model, index) => (
              <div key={index} className="text-xs text-blue-800">
                {index + 1}. {model}
              </div>
            ))}
          </div>
          <div className="text-xs text-blue-600 mt-2">
            Models selected based on file type and cost optimization
          </div>
        </div>
      )}
    </div>
  );
};