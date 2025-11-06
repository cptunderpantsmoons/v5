import React, { useState, useEffect } from 'react';

type ApiProvider = 'zai';

interface ApiConfigProps {
  provider: ApiProvider;
  model: string;
  onProviderChange: (provider: ApiProvider) => void;
  onModelChange: (model: string) => void;
}

const ZAI_MODELS = [
  { value: 'zai-model-1', label: 'Z.ai Model 1' },
  { value: 'zai-model-2', label: 'Z.ai Model 2' },
];

const ApiConfig: React.FC<ApiConfigProps> = ({ provider, model, onProviderChange, onModelChange }) => {
  return (
    <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 mb-8 max-w-4xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-4">API Configuration</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Provider Selection */}
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">API Provider</label>
          <div className="flex gap-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input 
                type="radio" 
                name="provider" 
                value="zai"
                checked={provider === 'zai'}
                onChange={() => onProviderChange('zai')}
                className="form-radio h-4 w-4 text-sky-600 bg-gray-100 border-gray-300 focus:ring-sky-500"
              />
              <span className="text-gray-800">Z.ai</span>
            </label>
          </div>
        </div>
        
        {/* Model Selection */}
        <div>
          <label htmlFor="model-select" className="block mb-2 text-sm font-medium text-gray-700">Model</label>
          <select 
            id="model-select" 
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full p-2.5"
          >
            {ZAI_MODELS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>
      
      
    </div>
  );
};

export default ApiConfig;