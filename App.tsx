import React, { useState, useRef, useEffect } from 'react';
import type { ReportData, VerificationResult } from './types';
import { generateFinancialReport, fixFinancialReport } from './services/geminiService';
import { verifyReportData } from './services/verificationService';
import { CrewAIWorkflowEngine, createFinancialReportWorkflow, Workflow } from './services/crewaiWorkflow';
import Header from './components/Header';
import ReportDisplay from './components/ReportDisplay';
import FileUpload from './components/FileUpload';
import ApiConfig from './components/ApiConfig';

type ApiProvider = 'gemini' | 'openrouter';

// Security: Environment-aware error handling
const isDevelopment = process.env.NODE_ENV === 'development';

const sanitizeErrorForUser = (error: unknown): string => {
    // In production, return generic error messages
    if (!isDevelopment) {
        return "An error occurred while processing your request. Please try again.";
    }
    
    // In development, provide more details for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[App] Development error:', {
        message: errorMessage,
        timestamp: new Date().toISOString(),
        stack: error instanceof Error ? error.stack : undefined
    });
    
    return `Development error: ${errorMessage}`;
};

const App: React.FC = () => {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file2024, setFile2024] = useState<File | null>(null);
  const [file2025, setFile2025] = useState<File | null>(null);
  const [companyName, setCompanyName] = useState<string>('');

  // New state for API config
  const [apiProvider, setApiProvider] = useState<ApiProvider>('gemini');
  const [apiKey, setApiKey] = useState<string>('');
  const [model, setModel] = useState<string>('gemini-2.5-flash');
  const [voiceModel, setVoiceModel] = useState<string>('elevenlabs/eleven-multilingual-v2');

  // Workflow system state
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [useCrewAI, setUseCrewAI] = useState<boolean>(false);
  const [workflowResults, setWorkflowResults] = useState<Map<string, any> | null>(null);

  const [retryAttempt, setRetryAttempt] = useState(0);
  const isGenerationCancelledRef = useRef(false);

  // On initial load, check for a saved report in localStorage.
  useEffect(() => {
    const savedReport = localStorage.getItem('financialReportData');
    const savedVerification = localStorage.getItem('financialVerificationResult');
    const savedCompanyName = localStorage.getItem('financialCompanyName'); // Fixed: removed extra 'local'
    const savedWorkflow = localStorage.getItem('crewaiWorkflow');

    if (savedReport && savedVerification && savedCompanyName) {
        try {
            setReportData(JSON.parse(savedReport));
            setVerificationResult(JSON.parse(savedVerification));
            setCompanyName(savedCompanyName);
        } catch (e) {
            // Sanitize error logging - only show generic message to user
            if (isDevelopment) {
                console.error('[App] Failed to parse saved report data from localStorage', e);
            }
            
            // Clear potentially corrupted data
            localStorage.removeItem('financialReportData');
            localStorage.removeItem('financialVerificationResult');
            localStorage.removeItem('financialCompanyName');
        }
    }

    // Load saved workflow
    if (savedWorkflow) {
        try {
            setWorkflow(JSON.parse(savedWorkflow));
        } catch (e) {
            if (isDevelopment) {
                console.error('[App] Failed to parse saved workflow from localStorage', e);
            }
            localStorage.removeItem('crewaiWorkflow');
        }
    }
  }, []); // Empty array ensures this runs only once on mount

  const handleGenerateReport = async () => {
    if (!file2024 || !file2025 || !companyName) {
      setError("Please provide a company name and upload both financial documents.");
      return;
    }
    
    if (apiProvider === 'openrouter' && !apiKey) {
      setError("API Key is required for OpenRouter.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setReportData(null);
    setVerificationResult(null);
    setWorkflowResults(null);
    setRetryAttempt(0);
    isGenerationCancelledRef.current = false;

    try {
      if (useCrewAI && workflow) {
        await generateReportWithCrewAI();
      } else {
        await generateReportStandard();
      }
    } catch (err) {
        if (!isGenerationCancelledRef.current) {
            // Sanitize error for user display
            const sanitizedError = sanitizeErrorForUser(err);
            setError(sanitizedError);
            
            // Log detailed error info only in development
            if (isDevelopment) {
                console.error('[App] Report generation error:', err);
            }
        } else {
             setError("Report generation was cancelled by the user.");
        }
    } finally {
        setIsLoading(false);
    }
  };

  const generateReportStandard = async () => {
    let attempt = 1;
    setRetryAttempt(attempt);

    const apiConfig = { provider: apiProvider, apiKey, model, voiceModel };

    // --- First Attempt ---
    let currentReportData = await generateFinancialReport(file2024, file2025, apiConfig);
    if (isGenerationCancelledRef.current) {
        setError("Report generation was cancelled by the user.");
        setIsLoading(false);
        return;
    }
    
    let currentVerification = verifyReportData(currentReportData);

    // --- Correction Loop ---
    while (!isGenerationCancelledRef.current && currentVerification.overallStatus === 'Failed') {
        attempt++;
        if (attempt > 5) { // Safety break to prevent infinite loops
            throw new Error("Failed to correct the report after multiple attempts. Please try again or use different source documents.");
        }
        setRetryAttempt(attempt);

        if (isDevelopment) {
            console.log(`Verification failed on attempt ${attempt - 1}. Attempting correction...`);
        }
        
        // Pass the failed report and verification result to the fix function
        currentReportData = await fixFinancialReport(currentReportData, currentVerification, apiConfig);

        if (isGenerationCancelledRef.current) {
            setError("Report generation was cancelled by the user.");
            setIsLoading(false);
            return;
        }

        currentVerification = verifyReportData(currentReportData);
    }

    if (currentVerification.overallStatus !== 'Failed') {
        setReportData(currentReportData);
        setVerificationResult(currentVerification);

        // Save the successful report to localStorage.
        try {
            localStorage.setItem('financialReportData', JSON.stringify(currentReportData));
            localStorage.setItem('financialVerificationResult', JSON.stringify(currentVerification));
            localStorage.setItem('financialCompanyName', companyName);
        } catch (e) {
            // Sanitize error logging - only log in development
            if (isDevelopment) {
                console.error('[App] Failed to save report data to localStorage', e);
            }
            // This is a non-critical error, so we don't show it to the user.
        }

    } else if (!isGenerationCancelledRef.current) {
         setError("The AI was unable to generate a mathematically consistent report after several attempts.");
    }
  };

  const generateReportWithCrewAI = async () => {
    if (!workflow) {
        throw new Error("CrewAI workflow not configured");
    }

    // Update workflow with current API configuration
    const updatedWorkflow = {
      ...workflow,
      agents: workflow.agents.map(agent => ({
        ...agent,
        llm: {
          provider: apiProvider,
          apiKey: apiKey,
          model: model,
          voiceModel: voiceModel
        }
      }))
    };

    const engine = new CrewAIWorkflowEngine(updatedWorkflow);
    const results = await engine.execute();
    setWorkflowResults(results);

    // Convert CrewAI results to standard report format
    // This would need to be implemented based on your specific workflow
    // For now, we'll fall back to standard generation
    console.log('CrewAI Results:', results);
    
    // You can implement the logic here to convert CrewAI results to ReportData format
    // For demonstration, we'll use the standard method
    await generateReportStandard();
  };

  const handleCancel = () => {
    isGenerationCancelledRef.current = true;
  };

  const handleReset = () => {
    isGenerationCancelledRef.current = true; // Cancel any ongoing generation
    setReportData(null);
    setVerificationResult(null);
    setError(null);
    setFile2024(null);
    setFile2025(null);
    setCompanyName('');
    setIsLoading(false);
    setRetryAttempt(0);
    setWorkflowResults(null);

    // Clear the saved report from localStorage.
    localStorage.removeItem('financialReportData');
    localStorage.removeItem('financialVerificationResult');
    localStorage.removeItem('financialCompanyName');
  };

  const handleWorkflowChange = (newWorkflow: Workflow) => {
    setWorkflow(newWorkflow);
    try {
      localStorage.setItem('crewaiWorkflow', JSON.stringify(newWorkflow));
    } catch (e) {
      if (isDevelopment) {
        console.error('[App] Failed to save workflow to localStorage', e);
      }
    }
  };

  const isGeneratorDisabled = !file2024 || !file2025 || !companyName || isLoading;

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 font-sans">
      <Header />
      <main className="container mx-auto p-4 md:p-8">
        {reportData && verificationResult ? (
          <>
            <ReportDisplay 
              data={reportData} 
              verification={verificationResult}
              onReset={handleReset}
              apiConfig={{ provider: apiProvider, apiKey, model, voiceModel }}
              companyName={companyName}
            />
          </>
        ) : (
          <>
            {/* Initial Upload View */}
            {!isLoading && (
              <div className="text-center max-w-4xl mx-auto mt-8 animate-fade-in">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">AI-Powered Financial Report Generation</h2>
                <p className="text-lg text-gray-600 mb-8">
                  Configure your AI providers, provide the company name, then upload the 2024 and 2025 financial documents.
                  Generate comprehensive reports with optional CrewAI workflow automation.
                </p>

                <ApiConfig 
                  provider={apiProvider}
                  apiKey={apiKey}
                  model={model}
                  voiceModel={voiceModel}
                  onProviderChange={setApiProvider}
                  onApiKeyChange={setApiKey}
                  onModelChange={setModel}
                  onVoiceModelChange={setVoiceModel}
                  onWorkflowChange={handleWorkflowChange}
                />

                {/* CrewAI Toggle */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">🤖 CrewAI Workflow</h3>
                      <p className="text-sm text-gray-600">
                        Use advanced AI agent workflows for complex report generation
                      </p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-sm text-gray-700">
                        {useCrewAI ? 'CrewAI Mode' : 'Standard Mode'}
                      </span>
                      <button
                        onClick={() => setUseCrewAI(!useCrewAI)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          useCrewAI ? 'bg-green-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            useCrewAI ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                  
                  {useCrewAI && workflow && (
                    <div className="mt-4 p-3 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-700">
                        ✅ CrewAI workflow loaded: {workflow.name} ({workflow.agents.length} agents, {workflow.tasks.length} tasks)
                      </p>
                    </div>
                  )}
                  
                  {useCrewAI && !workflow && (
                    <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                      <p className="text-sm text-yellow-700">
                        ⚠️ No CrewAI workflow configured. Click "CrewAI Workflow" in the configuration above to set up agents.
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
                    <div className="mb-6">
                        <label htmlFor="company-name" className="block mb-2 text-sm font-medium text-gray-700">Company Name</label>
                        <input 
                            type="text" 
                            id="company-name"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            placeholder="e.g., Example Corp Pty Ltd"
                            className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full p-2.5"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <FileUpload 
                        label="Upload 2024 Full Financial Statement"
                        selectedFile={file2024}
                        onFileSelect={setFile2024}
                        onFileRemove={() => setFile2024(null)}
                        acceptedFormats="image/*,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      />
                      <FileUpload 
                        label="Upload 2025 Current Financial Data"
                        selectedFile={file2025}
                        onFileSelect={setFile2025}
                        onFileRemove={() => setFile2025(null)}
                        acceptedFormats="image/*,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      />
                    </div>
                </div>
                
                <button
                  onClick={handleGenerateReport}
                  disabled={isGeneratorDisabled}
                  className={`
                    font-bold py-3 px-8 rounded-lg transition-all transform 
                    ${isGeneratorDisabled 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                      : `${useCrewAI ? 'bg-green-600 hover:bg-green-700 hover:scale-105 shadow-lg shadow-green-500/30' : 'bg-sky-600 hover:bg-sky-700 hover:scale-105 shadow-lg shadow-sky-500/30'}`
                    }
                  `}
                >
                  {isLoading ? 'Processing...' : `${useCrewAI ? '🤖 Generate with CrewAI' : '📊 Generate Report'}`}
                </button>
              </div>
            )}

            {/* Loading View */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center mt-24">
                <div className={`w-16 h-16 border-4 ${useCrewAI ? 'border-green-600' : 'border-sky-600'} border-t-transparent rounded-full animate-spin`}></div>
                <p className="mt-4 text-lg text-gray-700">
                  {useCrewAI ? '🤖 CrewAI Processing...' : retryAttempt <= 1 ? 'Generating Report...' : `Correcting Report (Attempt ${retryAttempt})`}
                </p>
                {retryAttempt > 1 && !useCrewAI && (
                    <p className="mt-2 text-sm text-yellow-600">Previous attempt failed verification. Attempting to fix errors...</p>
                )}
                {useCrewAI && workflowResults && (
                    <p className="mt-2 text-sm text-green-600">CrewAI agents working in parallel...</p>
                )}
                <p className="mt-2 text-sm text-gray-500 max-w-md text-center">
                  {useCrewAI 
                    ? 'Multiple AI agents are collaborating to create your financial report with advanced workflow automation.'
                    : 'The AI is working to create a mathematically consistent report. This may take a few attempts.'
                  }
                </p>
                <button
                  onClick={handleCancel}
                  className="mt-6 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition-colors transform hover:scale-105"
                >
                  Cancel Generation
                </button>
              </div>
            )}

            {/* Error View */}
            {error && !isLoading && (
              <div className="text-center max-w-2xl mx-auto mt-16 bg-red-100 border border-red-300 p-6 rounded-lg">
                <h3 className="text-2xl font-bold text-red-700 mb-2">Error</h3>
                <p className="text-red-600">{error}</p>
                 <button
                  onClick={handleReset}
                  className="mt-6 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg transition-transform transform hover:scale-105"
                 >
                  Start Over
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;