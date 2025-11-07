import React, { useState, useRef, useCallback } from 'react';

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

const FileUpload: React.FC<FileUploadProps> = ({
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

export default FileUpload;