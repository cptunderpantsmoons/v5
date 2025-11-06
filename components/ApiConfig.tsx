import React, { useState } from 'react';
import ModelConfig from './ModelConfig';

type ApiProvider = 'gemini' | 'openrouter';

interface ApiConfigProps {
  provider: ApiProvider;
  apiKey: string;
  model: string;
  voiceModel: string;
  onProviderChange: (provider: ApiProvider) => void;
  onApiKeyChange: (apiKey: string) => void;
  onModelChange: (model: string) => void;
  onVoiceModelChange: (voiceModel: string) => void;
}

const ApiConfig: React.FC<ApiConfigProps> = ({
  provider,
  apiKey,
  model,
  voiceModel,
  onProviderChange,
  onApiKeyChange,
  onModelChange,
  onVoiceModelChange
}) => {
  const [showModelConfig, setShowModelConfig] = useState(false);

  const geminiModels = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast & efficient for most tasks' },
    { id: 'gemini-2.0-flash-thinking-exp', name: 'Gemini 2.0 Flash Thinking', description: 'Advanced reasoning capabilities' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Long context understanding' }
  ];

  const openRouterModels = [
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Excellent for analysis & reasoning' },
    { id: 'openai/gpt-4o', name: 'GPT-4o', description: 'Multimodal capabilities' },
    { id: 'google/gemini-pro-vision', name: 'Gemini Pro Vision', description: 'Good for document analysis' },
    { id: 'nvidia/nemotron-nano-12b-v2-vl', name: 'NVIDIA Nemotron Nano 2 VL', description: 'Optimized for financial documents' }
  ];

  const voiceModels = [
    { id: 'elevenlabs/eleven-multilingual-v2', name: 'ElevenLabs Multilingual', description: 'High quality voice synthesis' },
    { id: 'openai/tts-1', name: 'OpenAI TTS', description: 'Natural sounding voice' },
    { id: 'coqui/tts', name: 'Coqui TTS', description: 'Open source voice synthesis' }
  ];

  const getCurrentModels = () => {
    if (provider === 'gemini') {
      return geminiModels;
    }
    return openRouterModels;
  };

  const handleModelConfigSave = (config: any) => {
    // Update the parent component with new config
    onProviderChange(config.provider);
    onApiKeyChange(config.apiKey);
    onModelChange(config.model);
    if (config.voiceModel) {
      onVoiceModelChange(config.voiceModel);
    }
  };

  return (
    <>
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">API Configuration</h2>
          <button
            onClick={() => setShowModelConfig(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Advanced Configuration
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AI Provider
            </label>
            <select
              value={provider}
              onChange={(e) => onProviderChange(e.target.value as ApiProvider)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            >
              <option value="gemini">Google Gemini (Free with API key)</option>
              <option value="openrouter">OpenRouter (Multiple models, pay-per-use)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {provider === 'gemini' ? 'Gemini API Key' : 'OpenRouter API Key'}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder={provider === 'gemini' ? 'Enter Gemini API key' : 'Enter OpenRouter API key'}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
            {provider === 'gemini' && (
              <p className="text-xs text-gray-500 mt-1">
                Get your API key from{' '}
                <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline">
                  Google AI Studio
                </a>
              </p>
            )}
            {provider === 'openrouter' && (
              <p className="text-xs text-gray-500 mt-1">
                Get your API key from{' '}
                <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline">
                  OpenRouter Dashboard
                </a>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {provider === 'gemini' ? 'Gemini Model' : 'OpenRouter Model'}
            </label>
            <select
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            >
              {getCurrentModels().map((modelOption) => (
                <option key={modelOption.id} value={modelOption.id}>
                  {modelOption.name} - {modelOption.description}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Voice Model (for Audio Summary)
            </label>
            <select
              value={voiceModel}
              onChange={(e) => onVoiceModelChange(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              disabled={provider === 'gemini'}
            >
              {voiceModels.map((voiceModelOption) => (
                <option key={voiceModelOption.id} value={voiceModelOption.id}>
                  {voiceModelOption.name} - {voiceModelOption.description}
                </option>
              ))}
            </select>
            {provider === 'gemini' && (
              <p className="text-xs text-gray-500 mt-1">
                Voice models only available with OpenRouter
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Current Configuration:</h4>
          <div className="text-xs text-gray-600 space-y-1">
            <div>Provider: <span className="font-medium">{provider}</span></div>
            <div>Model: <span className="font-medium">{model}</span></div>
            {voiceModel && <div>Voice Model: <span className="font-medium">{voiceModel}</span></div>}
            <div>API Key: <span className="font-medium">{apiKey ? '••••••••' : 'Not set'}</span></div>
          </div>
        </div>
      </div>

      {showModelConfig && (
        <ModelConfig
          currentConfig={{
            provider,
            apiKey,
            model,
            voiceModel
          }}
          onConfigChange={handleModelConfigSave}
          onClose={() => setShowModelConfig(false)}
        />
      )}
    </>
  );
};

export default ApiConfig;