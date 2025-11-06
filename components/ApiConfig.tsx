import React, { useState, useEffect } from 'react';

type ApiProvider = 'gemini' | 'openrouter';

interface ApiConfigProps {
  provider: ApiProvider;
  apiKey: string;
  model: string;
  voiceModel: string;
  onProviderChange: (provider: ApiProvider) => void;
  onApiKeyChange: (key: string) => void;
  onModelChange: (model: string) => void;
  onVoiceModelChange: (model: string) => void;
}

const GEMINI_MODELS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
];

const OPENROUTER_MODELS = [
    { value: 'google/gemini-2.5-pro', label: 'Google: Gemini 2.5 Pro' },
    { value: 'google/gemini-2.5-flash', label: 'Google: Gemini 2.5 Flash' },
    { value: 'openai/gpt-4o', label: 'OpenAI: GPT-4o' },
    { value: 'anthropic/claude-3.5-sonnet', label: 'Anthropic: Claude 3.5 Sonnet' },
    { value: 'anthropic/claude-3-opus', label: 'Anthropic: Claude 3 Opus' },
    { value: 'anthropic/claude-3-haiku', label: 'Anthropic: Claude 3 Haiku' },
];


const ApiConfig: React.FC<ApiConfigProps> = ({ provider, apiKey, model, voiceModel, onProviderChange, onApiKeyChange, onModelChange, onVoiceModelChange }) => {
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    // When provider changes, select a sensible default model for the new provider
    if (provider === 'gemini') {
        if (!GEMINI_MODELS.some(m => m.value === model)) {
            onModelChange(GEMINI_MODELS[0].value);
        }
    } else { // OpenRouter
        // Set a default if the current model is a Gemini one
        if (!OPENROUTER_MODELS.some(m => m.value === model)) {
             onModelChange(OPENROUTER_MODELS[0].value);
        }
    }
  }, [provider, model, onModelChange]);


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
                value="gemini"
                checked={provider === 'gemini'}
                onChange={() => onProviderChange('gemini')}
                className="form-radio h-4 w-4 text-sky-600 bg-gray-100 border-gray-300 focus:ring-sky-500"
              />
              <span className="text-gray-800">Google Gemini</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input 
                type="radio" 
                name="provider" 
                value="openrouter"
                checked={provider === 'openrouter'}
                onChange={() => onProviderChange('openrouter')}
                className="form-radio h-4 w-4 text-purple-600 bg-gray-100 border-gray-300 focus:ring-purple-500"
              />
              <span className="text-gray-800">OpenRouter</span>
            </label>
          </div>
        </div>
        
        {/* Model Selection */}
        <div>
          <label htmlFor="model-select" className="block mb-2 text-sm font-medium text-gray-700">Model</label>
          {provider === 'gemini' ? (
             <select 
                id="model-select" 
                value={model}
                onChange={(e) => onModelChange(e.target.value)}
                className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full p-2.5"
             >
                {GEMINI_MODELS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
             </select>
          ) : (
             <select 
                id="model-select" 
                value={model}
                onChange={(e) => onModelChange(e.target.value)}
                className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full p-2.5"
             >
                {OPENROUTER_MODELS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
             </select>
          )}
        </div>
      </div>
      
      {/* API Key Input */}
      <div className="mt-6">
        <label htmlFor="api-key-input" className="block mb-2 text-sm font-medium text-gray-700">
          API Key {provider === 'gemini' ? '(Optional - uses system key if blank)' : ''}
        </label>
        <div className="relative">
          <input 
            id="api-key-input"
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder={provider === 'gemini' ? 'Enter your Google Gemini API key' : 'Enter your OpenRouter API key (sk-or-v1-...)'}
            className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full p-2.5 pr-10"
          />
          <button 
            type="button" 
            onClick={() => setShowKey(!showKey)} 
            className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700"
            aria-label={showKey ? 'Hide API key' : 'Show API key'}
          >
            {showKey ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074L3.707 2.293zM10 12a2 2 0 110-4 2 2 0 010 4z" clipRule="evenodd" /><path d="M10 17a9.953 9.953 0 01-4.522-.997l1.523-1.523a4 4 0 005.998-5.998l1.523-1.523A9.953 9.953 0 0110 17z" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
            )}
          </button>
        </div>
      </div>
      
       {provider === 'openrouter' && (
         <div className="mt-6">
            <label htmlFor="voice-model-input" className="block mb-2 text-sm font-medium text-gray-700">
              Voice Model (for Audio Summary)
            </label>
            <input 
              id="voice-model-input"
              type="text"
              value={voiceModel}
              onChange={(e) => onVoiceModelChange(e.target.value)}
              placeholder="e.g., elevenlabs/eleven-multilingual-v2"
              className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full p-2.5"
            />
        </div>
      )}
    </div>
  );
};

export default ApiConfig;