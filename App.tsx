import React, { useState, useRef, useEffect } from 'react';
import type { ReportData, VerificationResult } from './types';
import { generateFinancialReport, fixFinancialReport } from './services/zaiService';
import { verifyReportData } from './services/verificationService';
import { useSecureErrorHandler } from './hooks/useSecureErrorHandler';
import { logger } from './utils/logger';
import { errorHandler, ErrorType } from './services/errorHandler';
import Header from './components/Header';
import ReportDisplay from './components/ReportDisplay';
import FileUpload from './components/FileUpload';
import ApiConfig from './components/ApiConfig';
import ErrorBoundary from './components/ErrorBoundary';

type ApiProvider = 'zai';

const App: React.FC = () => {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file2024, setFile2024] = useState<File | null>(null);
  const [file2025, setFile2025] = useState<File | null>(null);
  const [companyName, setCompanyName] = useState<string>('');

  // New state for API config
  const [apiProvider, setApiProvider] = useState<ApiProvider>('zai');
  const [model, setModel] = useState<string>('zai-model-1');

  const [retryAttempt, setRetryAttempt] = useState(0);
  const isGenerationCancelledRef = useRef(false);

  // Use secure error handler
  const { handleError, handleAsyncError } = useSecureErrorHandler({
    onError: (appError) => {
      // Log error internally but don't expose to user
      logger.error(`Application error: ${appError.id}`, {
        type: appError.type,
        severity: appError.severity,
        context: appError.context
      });
      
      setError(errorHandler.getUserMessage(appError));
    },
    context: {
      component: 'App',
      action: 'main'
    }
  });

  // On initial load, check for a saved report in localStorage.
  useEffect(() => {
    logger.info('Application starting up...');
    
    const savedReport = localStorage.getItem('financialReportData');
    const savedVerification = localStorage.getItem('financialVerificationResult');
    const savedCompanyName = localStorage.getItem('financialCompanyName');

    if (savedReport && savedVerification && savedCompanyName) {
      try {
        const parsedReport = JSON.parse(savedReport);
        const parsedVerification = JSON.parse(savedVerification);
        
        setReportData(parsedReport);
        setVerificationResult(parsedVerification);
        setCompanyName(savedCompanyName);
        
        logger.info('Successfully restored previous session data');
      } catch (e) {
        // Handle parsing error securely
        handleError(
          'Failed to restore previous session data',
          ErrorType.SYSTEM,
          { showToast: true }
        );
        
        // Clear potentially corrupted data
        localStorage.removeItem('financialReportData');
        localStorage.removeItem('financialVerificationResult');
        localStorage.removeItem('financialCompanyName');
      }
    }
  }, []); // Empty array ensures this runs only once on mount

  const handleGenerateReport = async () => {
    if (!file2024 || !file2025 || !companyName) {
      setError("Please provide a company name and upload both financial documents.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setReportData(null);
    setVerificationResult(null);
    setRetryAttempt(0);
    isGenerationCancelledRef.current = false;

    logger.info('Starting report generation', {
      companyName,
      file2024Name: file2024.name,
      file2025Name: file2025.name,
      retryAttempt: 0
    });

    try {
      let attempt = 1;
      setRetryAttempt(attempt);

      // Use empty string for apiKey since it's hardcoded in the service
      const apiConfig = { provider: apiProvider, apiKey: '', model };

      // --- First Attempt ---
      const generationResult = await handleAsyncError(
        () => generateFinancialReport(file2024, file2025, apiConfig),
        ErrorType.SYSTEM,
        {
          context: {
            phase: 'initial_generation',
            attempt: attempt,
            companyName
          }
        }
      );

      if (!generationResult.success) {
        throw new Error('Report generation failed');
      }
      
      let currentReportData = generationResult.data;
      
      if (isGenerationCancelledRef.current) {
        setError("Report generation was cancelled by the user.");
        setIsLoading(false);
        return;
      }
      
      let currentVerification = verifyReportData(currentReportData);
      logger.info('Initial verification completed', {
        status: currentVerification.overallStatus,
        passedChecks: currentVerification.checks.filter(c => c.passed).length,
        failedChecks: currentVerification.checks.filter(c => !c.passed).length
      });

      // --- Correction Loop ---
      while (!isGenerationCancelledRef.current && currentVerification.overallStatus === 'Failed') {
        attempt++;
        if (attempt > 5) { // Safety break to prevent infinite loops
          const errorMsg = "Failed to correct the report after 5 attempts. Please try again or use different source documents.";
          handleError(errorMsg, ErrorType.SYSTEM, { showToast: true });
          break;
        }
        setRetryAttempt(attempt);

        logger.warn(`Verification failed on attempt ${attempt - 1}. Starting correction...`, {
          failedChecks: currentVerification.checks.filter(c => !c.passed).map(c => c.name)
        });
        
        // Pass the failed report and verification result to the fix function
        const correctionResult = await handleAsyncError(
          () => fixFinancialReport(currentReportData, currentVerification, apiConfig),
          ErrorType.SYSTEM,
          {
            context: {
              phase: 'correction',
              attempt: attempt,
              previousFailedChecks: currentVerification.checks.filter(c => !c.passed).map(c => c.name)
            }
          }
        );

        if (!correctionResult.success) {
          throw new Error('Report correction failed');
        }

        if (isGenerationCancelledRef.current) {
          setError("Report generation was cancelled by the user.");
          setIsLoading(false);
          return;
        }

        currentReportData = correctionResult.data;
        currentVerification = verifyReportData(currentReportData);
        
        logger.info(`Correction attempt ${attempt} completed`, {
          status: currentVerification.overallStatus,
          passedChecks: currentVerification.checks.filter(c => c.passed).length,
          failedChecks: currentVerification.checks.filter(c => !c.passed).length
        });
      }

      if (currentVerification.overallStatus !== 'Failed') {
        setReportData(currentReportData);
        setVerificationResult(currentVerification);

        // Save the successful report to localStorage.
        try {
          localStorage.setItem('financialReportData', JSON.stringify(currentReportData));
          localStorage.setItem('financialVerificationResult', JSON.stringify(currentVerification));
          localStorage.setItem('financialCompanyName', companyName);
          
          logger.info('Successfully saved report data to localStorage');
        } catch (e) {
          logger.warn('Failed to save report data to localStorage', {
            error: e instanceof Error ? e.message : 'Unknown error'
          });
          // This is a non-critical error, so we don't show it to the user.
        }

      } else if (!isGenerationCancelledRef.current) {
        const errorMsg = "The AI was unable to generate a mathematically consistent report after several attempts.";
        handleError(errorMsg, ErrorType.SYSTEM, { showToast: true });
      }

    } catch (err) {
      if (!isGenerationCancelledRef.current) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        handleError(`Failed to generate report. ${errorMessage}`, ErrorType.SYSTEM, { showToast: true });
        
        logger.error('Report generation failed', {
          error: err instanceof Error ? err.message : 'Unknown error',
          attempt: retryAttempt,
          isCancelled: isGenerationCancelledRef.current
        });
      } else {
        setError("Report generation was cancelled by the user.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    isGenerationCancelledRef.current = true;
    logger.info('Report generation cancelled by user');
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

    // Clear the saved report from localStorage.
    try {
      localStorage.removeItem('financialReportData');
      localStorage.removeItem('financialVerificationResult');
      localStorage.removeItem('financialCompanyName');
      
      logger.info('Successfully cleared localStorage and reset application state');
    } catch (e) {
      logger.warn('Failed to clear localStorage during reset', {
        error: e instanceof Error ? e.message : 'Unknown error'
      });
    }
  };

  const isGeneratorDisabled = !file2024 || !file2025 || !companyName || isLoading;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-100 text-gray-800 font-sans">
        <Header />
        <main className="container mx-auto p-4 md:p-8">
          {reportData && verificationResult ? (
            <>
              <ReportDisplay 
                data={reportData} 
                verification={verificationResult}
                onReset={handleReset}
                companyName={companyName}
              />
            </>
          ) : (
            <>
              {/* Initial Upload View */}
              {!isLoading && (
                <div className="text-center max-w-4xl mx-auto mt-8 animate-fade-in">
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">Financial Statement Generation</h2>
                  <p className="text-lg text-gray-600 mb-8">
                    Provide the company name, then upload the 2024 and 2025 financial documents.
                    The AI will analyze them and generate a comparative report.
                  </p>

                  <ApiConfig 
                    provider={apiProvider}
                    model={model}
                    onProviderChange={setApiProvider}
                    onModelChange={setModel}
                  />
                  
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
                      bg-sky-600 text-white font-bold py-3 px-8 rounded-lg transition-all transform 
                      ${isGeneratorDisabled 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                        : 'hover:bg-sky-700 hover:scale-105 shadow-lg shadow-sky-500/30'
                      }
                    `}
                  >
                    {isLoading ? 'Analyzing...' : 'Generate Report'}
                  </button>
                </div>
              )}

              {/* Loading View */}
              {isLoading && (
                <div className="flex flex-col items-center justify-center mt-24">
                  <div className="w-16 h-16 border-4 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="mt-4 text-lg text-gray-700">
                    {retryAttempt <= 1 ? 'Generating Report...' : `Correcting Report (Attempt ${retryAttempt})`}
                  </p>
                  {retryAttempt > 1 && (
                      <p className="mt-2 text-sm text-yellow-600">Previous attempt failed verification. Attempting to fix errors...</p>
                  )}
                  <p className="mt-2 text-sm text-gray-500 max-w-md text-center">The AI is working to create a mathematically consistent report. This may take a few attempts.</p>
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
    </ErrorBoundary>
  );
};

export default App;