import React, { useState, useEffect } from 'react';
import type { ApiConfig } from '../services/geminiService';

type ApiProvider = 'gemini' | 'openrouter';

interface WorkflowStage {
  id: string;
  name: string;
  description: string;
  function: string;
  currentModel: string;
  availableModels: OpenRouterModel[];
  supportsProvider: 'gemini' | 'openrouter' | 'both';
}

interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  top_provider: {
    context_length: number;
    max_completion_tokens: number;
  };
}

interface ModelConfigProps {
  currentConfig: ApiConfig;
  onConfigChange: (config: ApiConfig) => void;
  onClose: () => void;
}

const ModelConfig: React.FC<ModelConfigProps> = ({ currentConfig, onConfigChange, onClose }) => {
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [workflowStages, setWorkflowStages] = useState<WorkflowStage[]>([]);
  const [activeTab, setActiveTab] = useState<'workflow' | 'models' | 'settings'>('workflow');

  // Predefined workflow stages with recommended models
  const defaultStages: WorkflowStage[] = [
    {
      id: 'main-generation',
      name: 'Main Financial Report Generation',
      description: 'Analyzes uploaded financial documents and generates comprehensive 2025 financial statements with mathematical verification',
      function: 'generateFinancialReport',
      currentModel: currentConfig.model,
      availableModels: [],
      supportsProvider: 'both'
    },
    {
      id: 'error-correction',
      name: 'Report Error Correction',
      description: 'Automatically fixes mathematical errors and inconsistencies found during verification',
      function: 'fixFinancialReport',
      currentModel: currentConfig.model,
      availableModels: [],
      supportsProvider: 'both'
    },
    {
      id: 'audio-summary',
      name: 'Audio Summary Generation',
      description: 'Converts the financial report summary into professional audio narration',
      function: 'generateAudioSummary',
      currentModel: currentConfig.voiceModel || 'elevenlabs/eleven-multilingual-v2',
      availableModels: [],
      supportsProvider: 'openrouter'
    }
  ];

  useEffect(() => {
    setWorkflowStages(defaultStages);
    fetchOpenRouterModels();
  }, []);

  const fetchOpenRouterModels = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models');
      const data = await response.json();
      setOpenRouterModels(data.data || []);
    } catch (error) {
      console.error('Failed to fetch OpenRouter models:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModelChange = (stageId: string, newModel: string) => {
    setWorkflowStages(prev => prev.map(stage => 
      stage.id === stageId 
        ? { ...stage, currentModel: newModel }
        : stage
    ));
  };

  const handleSaveConfiguration = () => {
    // Update the main config based on selected models
    const mainGenerationStage = workflowStages.find(s => s.id === 'main-generation');
    const audioStage = workflowStages.find(s => s.id === 'audio-summary');
    
    const newConfig: ApiConfig = {
      ...currentConfig,
      model: mainGenerationStage?.currentModel || currentConfig.model,
      voiceModel: audioStage?.currentModel || currentConfig.voiceModel
    };
    
    onConfigChange(newConfig);
    onClose();
  };

  const getModelProvider = (modelId: string) => {
    return modelId.includes('/') ? 'openrouter' : 'gemini';
  };

  const formatPrice = (price: string) => {
    if (price === '0') return 'Free';
    return `$${price}/1K tokens`;
  };

  const renderWorkflowStage = (stage: WorkflowStage) => {
    const modelsToShow = stage.id === 'audio-summary' 
      ? openRouterModels.filter(m => m.id.includes('speech') || m.id.includes('tts') || m.id.includes('audio'))
      : openRouterModels;

    return (
      <div key={stage.id} className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{stage.name}</h3>
            <p className="text-sm text-gray-600 mb-3">{stage.description}</p>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className={`px-2 py-1 rounded-full ${
                stage.supportsProvider === 'both' ? 'bg-blue-100 text-blue-700' :
                stage.supportsProvider === 'openrouter' ? 'bg-green-100 text-green-700' :
                'bg-purple-100 text-purple-700'
              }`}>
                {stage.supportsProvider === 'both' ? 'Gemini + OpenRouter' :
                 stage.supportsProvider === 'openrouter' ? 'OpenRouter Only' :
                 'Gemini Only'}
              </span>
              <span>Function: {stage.function}</span>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Model
            </label>
            <select
              value={stage.currentModel}
              onChange={(e) => handleModelChange(stage.id, e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            >
              {stage.supportsProvider !== 'openrouter' && (
                <optgroup label="Gemini Models">
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast & Efficient)</option>
                  <option value="gemini-2.0-flash-thinking-exp">Gemini 2.0 Flash Thinking (Advanced Reasoning)</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro (Long Context)</option>
                </optgroup>
              )}
              
              {stage.id === 'audio-summary' ? (
                <optgroup label="OpenRouter Audio Models">
                  {modelsToShow.filter(m => m.id.includes('speech') || m.id.includes('tts') || m.id.includes('audio')).map(model => (
                    <option key={model.id} value={model.id}>
                      {model.name} - {formatPrice(model.pricing.prompt)}
                    </option>
                  ))}
                </optgroup>
              ) : (
                <optgroup label="OpenRouter LLMs">
                  {modelsToShow.filter(m => !m.id.includes('speech') && !m.id.includes('tts') && !m.id.includes('audio')).map(model => (
                    <option key={model.id} value={model.id}>
                      {model.name} - {formatPrice(model.pricing.prompt)}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          
          {modelsToShow.length > 0 && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-xs text-gray-600">
                <strong>Selected Model Info:</strong>
                {(() => {
                  const selectedModel = modelsToShow.find(m => m.id === stage.currentModel);
                  return selectedModel ? (
                    <div className="mt-1 space-y-1">
                      <div>Context Length: {selectedModel.context_length?.toLocaleString() || 'N/A'} tokens</div>
                      <div>Max Output: {selectedModel.top_provider?.max_completion_tokens?.toLocaleString() || 'N/A'} tokens</div>
                      <div>Prompt Cost: {formatPrice(selectedModel.pricing.prompt)}</div>
                      <div>Completion Cost: {formatPrice(selectedModel.pricing.completion)}</div>
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">AI Model Configuration</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-xl"
            >
              ×
            </button>
          </div>
        </div>

        <div className="border-b border-gray-200">
          <nav className="flex px-6" aria-label="Tabs">
            {[
              { id: 'workflow', name: 'Workflow Configuration' },
              { id: 'models', name: 'Available Models' },
              { id: 'settings', name: 'Settings' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`${
                  activeTab === tab.id
                    ? 'border-sky-600 text-sky-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'workflow' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-blue-900 mb-2">Workflow Overview</h3>
                <p className="text-sm text-blue-700">
                  The financial report generation process uses multiple AI models at different stages. 
                  You can configure which model to use for each part of the workflow to optimize for 
                  cost, speed, or quality based on your needs.
                </p>
              </div>

              {workflowStages.map(renderWorkflowStage)}
            </div>
          )}

          {activeTab === 'models' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Available OpenRouter Models</h3>
                <button
                  onClick={fetchOpenRouterModels}
                  disabled={isLoading}
                  className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:bg-gray-400"
                >
                  {isLoading ? 'Loading...' : 'Refresh Models'}
                </button>
              </div>

              {isLoading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading available models...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {openRouterModels.map((model) => (
                    <div key={model.id} className="bg-white p-4 rounded-lg border border-gray-200">
                      <h4 className="font-semibold text-sm text-gray-900 mb-2">{model.name}</h4>
                      <p className="text-xs text-gray-600 mb-3 line-clamp-2">{model.description}</p>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Context:</span>
                          <span className="font-medium">{model.context_length?.toLocaleString() || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Prompt:</span>
                          <span className="font-medium">{formatPrice(model.pricing.prompt)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Output:</span>
                          <span className="font-medium">{formatPrice(model.pricing.completion)}</span>
                        </div>
                      </div>
                      <div className="mt-2">
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                          {model.id.split('/')[0]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold mb-4">Global Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Primary Provider
                    </label>
                    <select
                      value={currentConfig.provider}
                      onChange={(e) => onConfigChange({ ...currentConfig, provider: e.target.value as ApiProvider })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    >
                      <option value="gemini">Google Gemini</option>
                      <option value="openrouter">OpenRouter</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      API Key
                    </label>
                    <input
                      type="password"
                      value={currentConfig.apiKey}
                      onChange={(e) => onConfigChange({ ...currentConfig, apiKey: e.target.value })}
                      placeholder="Enter your API key"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    />
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-semibold text-yellow-800 mb-2">Cost Optimization Tips</h4>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      <li>• Use faster models for initial generation, slower models for final review</li>
                      <li>• Audio generation is typically more expensive - use sparingly</li>
                      <li>• Consider context length vs. cost for your document size</li>
                      <li>• Test different models to find the best price/performance ratio</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 px-6 py-4">
          <div className="flex justify-end gap-4">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveConfiguration}
              className="px-6 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelConfig;