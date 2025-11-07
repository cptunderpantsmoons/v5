import React, { useState, useEffect } from 'react';
import { ApiKeyManager, type ApiKeyConfig, type ApiKeyValidationResult } from '../services/utils/apiKeyManager';

interface ApiConfigProps {
  onConfigChange?: (config: ApiKeyConfig) => void;
  initialConfig?: ApiKeyConfig;
}

export const ApiConfig: React.FC<ApiConfigProps> = ({ 
  onConfigChange, 
  initialConfig 
}) => {
  const [provider, setProvider] = useState<'openrouter' | 'gemini'>(
    initialConfig?.provider || 'openrouter'
  );
  const [apiKey, setApiKey] = useState(initialConfig?.apiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ApiKeyValidationResult | null>(null);
  const [savedConfigs, setSavedConfigs] = useState<Record<string, ApiKeyConfig>>({});

  // Load saved configs on mount
  useEffect(() => {
    const configs = ApiKeyManager.getAllApiKeys();
    setSavedConfigs(configs);
    
    if (initialConfig) {
      setProvider(initialConfig.provider);
      setApiKey(initialConfig.apiKey);
    } else if (configs.openrouter) {
      setProvider('openrouter');
      setApiKey(configs.openrouter.apiKey);
    }
  }, [initialConfig]);

  // Validate API key when it changes
  useEffect(() => {
    if (apiKey.length > 0) {
      validateApiKey();
    } else {
      setValidationResult(null);
    }
  }, [apiKey, provider]);

  const validateApiKey = async () => {
    if (!apiKey.trim()) return;
    
    setIsValidating(true);
    try {
      const result = await ApiKeyManager.validateApiKey(apiKey, provider);
      setValidationResult(result);
      
      if (result.isValid && onConfigChange) {
        const config: ApiKeyConfig = {
          provider,
          apiKey,
          lastValidated: result.lastValidated,
          isValid: true
        };
        onConfigChange(config);
      }
    } catch (error) {
      setValidationResult({
        isValid: false,
        provider,
        error: error instanceof Error ? error.message : 'Validation failed',
        lastValidated: new Date()
      });
    } finally {
      setIsValidating(false);
    }
  };

  const saveApiKey = () => {
    if (!validationResult?.isValid) {
      alert('Please validate API key before saving');
      return;
    }

    const config: ApiKeyConfig = {
      provider,
      apiKey,
      lastValidated: validationResult.lastValidated,
      isValid: true
    };
    
    ApiKeyManager.storeApiKey(config);
    
    // Update saved configs
    const newConfigs = { ...savedConfigs, [provider]: config };
    setSavedConfigs(newConfigs);
    
    alert('API key saved successfully');
  };

  const deleteApiKey = (providerToDelete: 'openrouter' | 'gemini') => {
    if (confirm(`Are you sure you want to delete ${providerToDelete} API key?`)) {
      ApiKeyManager.removeApiKey(providerToDelete);
      
      const newConfigs = { ...savedConfigs };
      delete newConfigs[providerToDelete];
      setSavedConfigs(newConfigs);
      
      if (providerToDelete === provider) {
        setProvider('openrouter');
        setApiKey('');
        setValidationResult(null);
      }
    }
  };

  const exportKeys = () => {
    const exportData = ApiKeyManager.exportApiKeys();
    
    // Create download link
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-keys-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importKeys = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const result = ApiKeyManager.importApiKeys(content);
          
          if (result.success) {
            alert(`Successfully imported ${result.imported.length} API keys`);
            const newConfigs = ApiKeyManager.getAllApiKeys();
            setSavedConfigs(newConfigs);
          } else {
            alert(`Import failed: ${result.errors.join(', ')}`);
          }
        } catch (error) {
          alert(`Import failed: ${error}`);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const refreshValidation = async () => {
    if (!apiKey) return;
    
    setIsValidating(true);
    try {
      const result = await ApiKeyManager.refreshValidation(provider);
      setValidationResult(result);
    } catch (error) {
      setValidationResult({
        isValid: false,
        provider,
        error: error instanceof Error ? error.message : 'Refresh failed',
        lastValidated: new Date()
      });
    } finally {
      setIsValidating(false);
    }
  };

  const getProviderDisplayName = (p: 'openrouter' | 'gemini') => {
    switch (p) {
      case 'openrouter': return 'OpenRouter';
      case 'gemini': return 'Google Gemini';
      default: return p;
    }
  };

  const getProviderDescription = (p: 'openrouter' | 'gemini') => {
    switch (p) {
      case 'openrouter': return 'Access to multiple AI models including Grok, Claude, and Gemini';
      case 'gemini': return 'Direct access to Google Gemini models';
      default: return '';
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
      <h2 className="text-xl font-semibold mb-6">API Configuration</h2>
      
      {/* Provider Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          API Provider
        </label>
        <div className="grid grid-cols-2 gap-4">
          {(['openrouter', 'gemini'] as const).map((p) => (
            <div
              key={p}
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                provider === p
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onClick={() => setProvider(p)}
            >
              <div className="font-medium">{getProviderDisplayName(p)}</div>
              <div className="text-sm text-gray-600 mt-1">
                {getProviderDescription(p)}
              </div>
              {savedConfigs[p] && (
                <div className="text-xs text-green-600 mt-2">
                  ✓ Configured
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* API Key Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {getProviderDisplayName(provider)} API Key
        </label>
        <div className="flex gap-2">
          <input
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={`Enter your ${getProviderDisplayName(provider)} API key...`}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            {showApiKey ? 'Hide' : 'Show'}
          </button>
        </div>
        
        {/* Validation Status */}
        {validationResult && (
          <div className={`mt-2 p-2 rounded text-sm ${
            validationResult.isValid
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}>
            {validationResult.isValid ? (
              <span>✓ Valid API key</span>
            ) : (
              <span>✗ {validationResult.error}</span>
            )}
            {validationResult.lastValidated && (
              <div className="text-xs mt-1">
                Last validated: {validationResult.lastValidated.toLocaleString()}
              </div>
            )}
          </div>
        )}
        
        {/* Usage Information */}
        {validationResult.usage && (
          <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
            <div>Estimated daily usage: ${validationResult.usage.daily}</div>
            <div>Estimated monthly usage: ${validationResult.usage.monthly}</div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={validateApiKey}
          disabled={!apiKey || isValidating}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isValidating ? 'Validating...' : 'Validate'}
        </button>
        
        <button
          onClick={saveApiKey}
          disabled={!validationResult?.isValid}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          Save
        </button>
        
        <button
          onClick={refreshValidation}
          disabled={!apiKey || isValidating}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {/* Saved Configurations */}
      {Object.keys(savedConfigs).length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">Saved Configurations</h3>
          <div className="space-y-2">
            {Object.entries(savedConfigs).map(([p, config]) => (
              <div
                key={p}
                className={`p-3 border rounded-md flex justify-between items-center ${
                  p === provider ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                }`}
              >
                <div>
                  <div className="font-medium">{getProviderDisplayName(p as any)}</div>
                  <div className="text-sm text-gray-600">
                    {config.isValid ? 'Validated' : 'Not validated'}
                  </div>
                  {config.lastValidated && (
                    <div className="text-xs text-gray-500">
                      {config.lastValidated.toLocaleString()}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setProvider(p as any);
                      setApiKey(config.apiKey);
                    }}
                    className="px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Use
                  </button>
                  <button
                    onClick={() => deleteApiKey(p as any)}
                    className="px-2 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Import/Export */}
      <div className="border-t pt-4">
        <h3 className="text-lg font-medium mb-3">Backup & Restore</h3>
        <div className="flex gap-2">
          <button
            onClick={exportKeys}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Export All Keys
          </button>
          <button
            onClick={importKeys}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Import Keys
          </button>
          <button
            onClick={() => {
              if (confirm('Clear all saved API keys?')) {
                ApiKeyManager.clearAllApiKeys();
                setSavedConfigs({});
                setApiKey('');
                setValidationResult(null);
              }
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  );
};