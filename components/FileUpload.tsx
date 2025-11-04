
import React, { useRef, useState, useCallback } from 'react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
  selectedFile: File | null;
  label: string;
  acceptedFormats: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, onFileRemove, selectedFile, label, acceptedFormats }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const openFileDialog = () => {
    inputRef.current?.click();
  };

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);
  
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  }, [onFileSelect]);


  return (
    <div className="w-full">
        <label className="block mb-2 text-sm font-medium text-gray-700">{label}</label>
        <div
          onClick={!selectedFile ? openFileDialog : undefined}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`
            flex justify-center items-center w-full h-48 px-4 transition bg-white border-2 
            ${isDragging ? 'border-sky-500' : 'border-gray-300'} 
            border-dashed rounded-lg cursor-pointer hover:border-sky-500
          `}
        >
          {selectedFile ? (
             <div className="text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="mt-2 text-sm text-gray-700 font-semibold">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                <button 
                    onClick={onFileRemove}
                    className="mt-3 text-xs text-red-600 hover:text-red-500 font-bold py-1 px-2 rounded-md bg-red-100"
                >
                    Remove File
                </button>
             </div>
          ) : (
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="mt-1 text-sm text-gray-600">
                <span className="font-semibold text-sky-600">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500">PDF, Excel, PNG, JPG, etc.</p>
            </div>
          )}
        </div>
        <input
          type="file"
          ref={inputRef}
          onChange={handleFileChange}
          className="hidden"
          accept={acceptedFormats}
        />
    </div>
  );
};

export default FileUpload;