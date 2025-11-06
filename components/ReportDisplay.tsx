import React, { useRef, useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { ReportData, VerificationResult } from '../types';
import { generateAASBPdf } from '../services/pdfGenerator';
import { useSecureErrorHandler } from '../hooks/useSecureErrorHandler';
import { errorHandler, ErrorType } from '../services/errorHandler';
import { logger } from '../utils/logger';
import KPICard from './KPICard';
import ComparisonChart from './ComparisonChart';
import ComparisonTable from './ComparisonTable';
import VerificationCertificate from './VerificationCertificate';
import AASBPreview from './AASBPreview';

interface ReportDisplayProps {
  data: ReportData;
  verification: VerificationResult;
  onReset: () => void;
  companyName: string;
}

const SummaryRow: React.FC<{ title: string; values: any; isEditing: boolean }> = ({ title, values, isEditing }) => {
    if (!values) return null;
    const formatCurrency = (value: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
    const editableClass = isEditing ? 'p-1 rounded outline-dashed outline-1 outline-sky-500' : '';
    return (
      <div className="bg-gray-50 rounded-b-lg">
        <table className="w-full text-sm">
          <tbody>
            <tr className="font-bold">
              <th scope="row" className="px-6 py-3 text-left font-semibold text-gray-800 whitespace-nowrap">
                <span contentEditable={isEditing} suppressContentEditableWarning={true} className={editableClass}>
                    {title}
                </span>
                {values.noteRef && (
                  <a href={`#note-${values.noteRef}`} className="ml-2 text-gray-500 hover:text-sky-600 no-underline" title={`Reference to Note ${values.noteRef}`}>
                    <sup className="text-xs font-mono py-0.5 px-1.5 rounded-sm bg-gray-200">({values.noteRef})</sup>
                  </a>
                )}
              </th>
              <td 
                contentEditable={isEditing}
                suppressContentEditableWarning={true}
                className={`px-6 py-3 text-right font-mono ${values.amount2025 < 0 ? 'text-red-600' : 'text-gray-900'} ${editableClass}`}
              >
                {formatCurrency(values.amount2025)}
              </td>
              <td 
                contentEditable={isEditing}
                suppressContentEditableWarning={true}
                className={`px-6 py-3 text-right font-mono ${values.amount2024 < 0 ? 'text-red-600' : 'text-gray-600'} ${editableClass}`}
              >
                {formatCurrency(values.amount2024)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
};

const ReportDisplay: React.FC<ReportDisplayProps> = ({ data, verification, onReset, companyName }) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isGeneratingAASBPdf, setIsGeneratingAASBPdf] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'report' | 'verification' | 'aasb'>('report');
  
  // Use secure error handler
  const { handleError } = useSecureErrorHandler({
    context: {
      component: 'ReportDisplay',
      companyName
    }
  });

  const { incomeStatement, balanceSheet, cashFlowStatement } = data;

  const handleDownloadViewPdf = () => {
    try {
      const input = reportRef.current;
      if (!input) {
        handleError('PDF generation failed - report content not found', ErrorType.SYSTEM, { showToast: true });
        return;
      }

      logger.info('Starting view PDF generation', {
        hasReportRef: !!input,
        activeTab,
        isEditing
      });

      // Temporarily set editing to false to hide outlines during PDF generation
      const wasEditing = isEditing;
      if (wasEditing) setIsEditing(false);

      // Allow state to update before capturing
      setTimeout(() => {
        html2canvas(input, { 
            useCORS: true,
            scale: 1.5,
            backgroundColor: '#ffffff'
        }).then((canvas) => {
            try {
                const imgData = canvas.toDataURL('image/jpeg', 0.85);
                const pdf = new jsPDF({
                    orientation: 'p',
                    unit: 'px',
                    format: [canvas.width, canvas.height]
                });
                pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
                pdf.save('financial-report-view.pdf');
                
                logger.info('Successfully generated view PDF');

                // Restore editing state
                if (wasEditing) setIsEditing(true);
            } catch (pdfError) {
                logger.error('Error creating PDF from canvas', {
                  error: pdfError instanceof Error ? pdfError.message : 'Unknown error'
                });
                handleError('Failed to create PDF file', ErrorType.SYSTEM, { showToast: true });
                
                // Restore editing state
                if (wasEditing) setIsEditing(true);
            }
        }).catch((canvasError) => {
            logger.error('Error capturing report as image', {
              error: canvasError instanceof Error ? canvasError.message : 'Unknown error'
            });
            handleError('Failed to capture report content', ErrorType.SYSTEM, { showToast: true });
        });
      }, 100);
    } catch (error) {
      logger.error('Error in PDF download process', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      handleError('PDF download failed', ErrorType.SYSTEM, { showToast: true });
    }
  };

  const handleDownloadAASBPdf = async () => {
    setIsGeneratingAASBPdf(true);
    
    try {
      logger.info('Starting AASB PDF generation', {
        companyName,
        hasData: !!data
      });
      
      // Use a timeout to allow the UI to update to the loading state before the blocking PDF generation begins
      await new Promise(resolve => setTimeout(resolve, 50));
      generateAASBPdf(data, companyName);
      
      logger.info('Successfully generated AASB PDF');
    } catch (e) {
      logger.error('Failed to generate AASB PDF', {
        error: e instanceof Error ? e.message : 'Unknown error',
        companyName
      });
      handleError('Failed to generate AASB report PDF', ErrorType.SYSTEM, { showToast: true });
    } finally {
      setIsGeneratingAASBPdf(false);
    }
  };

  const handleTabChange = (tab: 'report' | 'verification' | 'aasb') => {
    logger.debug('User changed active tab', {
      from: activeTab,
      to: tab,
      companyName
    });
    setActiveTab(tab);
  };

  const getVerificationStatusStyles = () => {
    switch(verification.overallStatus) {
        case 'Passed': return { text: 'text-green-700', bg: 'bg-green-100'};
        case 'Passed with Warnings': return { text: 'text-yellow-700', bg: 'bg-yellow-100'};
        case 'Failed': return { text: 'text-red-700', bg: 'bg-red-100' };
        default: return { text: 'text-gray-700', bg: 'bg-gray-100' };
    }
  };
  
  const statusStyles = getVerificationStatusStyles();

  try {
    return (
      <div className="animate-fade-in">
          {/* Top Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-bold">Generated Report</h2>
                  <div className={`text-sm font-semibold py-1 px-3 rounded-full flex items-center gap-2 ${statusStyles.bg}`}>
                     <span className={`${statusStyles.text}`}>●</span>
                     <span className={statusStyles.text}>Verification: {verification.overallStatus}</span>
                  </div>
              </div>
              <div className="flex flex-wrap justify-end gap-4">
                  <button
                      onClick={onReset}
                      className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                    >
                      Analyze New Reports
                  </button>
                  
                  {(activeTab === 'report' || activeTab === 'aasb') && (
                      <button
                          onClick={() => {
                            logger.debug('User toggled edit mode', { wasEditing: isEditing, newState: !isEditing });
                            setIsEditing(!isEditing);
                          }}
                          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                        >
                          {isEditing ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a2 2 0 011.414 0z" clipRule="evenodd" /></svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                          )}
                          {isEditing ? 'Finish Editing' : 'Edit Report'}
                      </button>
                  )}
                  {activeTab === 'report' && (
                      <button
                          onClick={handleDownloadViewPdf}
                          className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                      >
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                          Download View as PDF
                      </button>
                  )}
              </div>
          </div>
          

          {/* Tabs */}
          <div className="border-b border-gray-300 mb-6">
              <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                  <button
                      onClick={() => handleTabChange('report')}
                      className={`${activeTab === 'report' ? 'border-sky-600 text-sky-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-400'}
                      whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                  >
                      Financial Report
                  </button>
                   <button
                      onClick={() => handleTabChange('aasb')}
                      className={`${activeTab === 'aasb' ? 'border-sky-600 text-sky-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-400'}
                      whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                  >
                      AASB Report
                  </button>
                  <button
                      onClick={() => handleTabChange('verification')}
                      className={`${activeTab === 'verification' ? 'border-sky-600 text-sky-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-400'}
                      whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2`}
                  >
                      Verification Certificate
                      {verification.overallStatus === 'Failed' && <span className="w-2.5 h-2.5 bg-red-500 rounded-full"></span>}
                      {verification.overallStatus === 'Passed with Warnings' && <span className="w-2.5 h-2.5 bg-yellow-500 rounded-full"></span>}
                  </button>
              </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'report' ? (
               <div ref={reportRef} className="space-y-8 p-4 bg-white">
                {/* Summary Section */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                  <h2 className="text-2xl font-bold text-sky-600 mb-3">Financial Summary</h2>
                  <p 
                    contentEditable={isEditing}
                    suppressContentEditableWarning={true}
                    className={`text-gray-700 leading-relaxed ${isEditing ? 'p-2 rounded outline-dashed outline-1 outline-sky-500' : ''}`}
                  >
                    {data.summary}
                  </p>
                </div>
                
                {/* KPIs Section */}
                <div>
                  <h2 className="text-2xl font-bold mb-4">Key Performance Indicators</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {data.kpis.map((kpi) => (
                      <KPICard key={kpi.name} kpi={kpi} />
                    ))}
                  </div>
                </div>

                {/* Visualizations Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                      <h2 className="text-xl font-bold text-center mb-4">Income Statement</h2>
                      <ComparisonChart data={[ { item: 'Revenue', ...incomeStatement.revenue.reduce((acc, cv) => ({ amount2024: acc.amount2024 + cv.amount2024, amount2025: acc.amount2025 + cv.amount2025 }), {amount2024: 0, amount2025: 0})}, { item: 'Net Profit', ...incomeStatement.netProfit } ]} />
                  </div>
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                      <h2 className="text-xl font-bold text-center mb-4">Balance Sheet</h2>
                       <ComparisonChart data={[ { item: 'Total Assets', ...balanceSheet.totalAssets }, { item: 'Total Liabilities', ...balanceSheet.totalLiabilities }, { item: 'Total Equity', ...balanceSheet.totalEquity } ]} />
                  </div>
                   <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                      <h2 className="text-xl font-bold text-center mb-4">Cash Flow</h2>
                       <ComparisonChart data={[ { item: 'Operating', ...cashFlowStatement.operatingActivities.reduce((acc, cv) => ({ amount2024: acc.amount2024 + cv.amount2024, amount2025: acc.amount2025 + cv.amount2025 }), {amount2024: 0, amount2025: 0}) }, { item: 'Investing', ...cashFlowStatement.investingActivities.reduce((acc, cv) => ({ amount2024: acc.amount2024 + cv.amount2024, amount2025: acc.amount2025 + cv.amount2025 }), {amount2024: 0, amount2025: 0}) }, { item: 'Financing', ...cashFlowStatement.financingActivities.reduce((acc, cv) => ({ amount2024: acc.amount2024 + cv.amount2024, amount2025: acc.amount2025 + cv.amount2025 }), {amount2024: 0, amount2025: 0}) } ]} />
                  </div>
                </div>
                
                {/* Data Tables Section */}
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                      <h2 className="text-2xl font-bold mb-4">Income Statement</h2>
                      <h3 className="text-lg font-semibold text-sky-600 mt-4 mb-2">Revenue</h3>
                      <ComparisonTable items={incomeStatement.revenue} isEditing={isEditing} />
                      <SummaryRow title="Gross Profit" values={incomeStatement.grossProfit} isEditing={isEditing} />
                      <h3 className="text-lg font-semibold text-sky-600 mt-6 mb-2">Operating Expenses</h3>
                      <ComparisonTable items={incomeStatement.expenses} isEditing={isEditing} />
                      <SummaryRow title="Operating Income" values={incomeStatement.operatingIncome} isEditing={isEditing} />
                      <SummaryRow title="Net Profit/Loss" values={incomeStatement.netProfit} isEditing={isEditing} />
                  </div>

                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                      <h2 className="text-2xl font-bold mb-4">Balance Sheet</h2>
                      <h3 className="text-lg font-semibold text-sky-600 mt-4 mb-2">Assets</h3>
                      <p className="text-md font-semibold text-gray-700 mt-4 mb-2 pl-4">Current Assets</p>
                      <ComparisonTable items={balanceSheet.currentAssets} isEditing={isEditing} />
                      <p className="text-md font-semibold text-gray-700 mt-4 mb-2 pl-4">Non-Current Assets</p>
                      <ComparisonTable items={balanceSheet.nonCurrentAssets} isEditing={isEditing} />
                      <SummaryRow title="Total Assets" values={balanceSheet.totalAssets} isEditing={isEditing} />

                      <h3 className="text-lg font-semibold text-sky-600 mt-6 mb-2">Liabilities & Equity</h3>
                       <p className="text-md font-semibold text-gray-700 mt-4 mb-2 pl-4">Current Liabilities</p>
                      <ComparisonTable items={balanceSheet.currentLiabilities} isEditing={isEditing} />
                       <p className="text-md font-semibold text-gray-700 mt-4 mb-2 pl-4">Non-Current Liabilities</p>
                      <ComparisonTable items={balanceSheet.nonCurrentLiabilities} isEditing={isEditing} />
                      <SummaryRow title="Total Liabilities" values={balanceSheet.totalLiabilities} isEditing={isEditing} />
                       <p className="text-md font-semibold text-gray-700 mt-4 mb-2 pl-4">Equity</p>
                      <ComparisonTable items={balanceSheet.equity} isEditing={isEditing} />
                      <SummaryRow title="Total Equity" values={balanceSheet.totalEquity} isEditing={isEditing} />
                  </div>

                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                      <h2 className="text-2xl font-bold mb-4">Statement of Cash Flows</h2>
                      <h3 className="text-lg font-semibold text-sky-600 mt-4 mb-2">Operating Activities</h3>
                      <ComparisonTable items={cashFlowStatement.operatingActivities} isEditing={isEditing} />
                      <h3 className="text-lg font-semibold text-sky-600 mt-6 mb-2">Investing Activities</h3>
                      <ComparisonTable items={cashFlowStatement.investingActivities} isEditing={isEditing} />
                      <h3 className="text-lg font-semibold text-sky-600 mt-6 mb-2">Financing Activities</h3>
                      <ComparisonTable items={cashFlowStatement.financingActivities} isEditing={isEditing} />
                      <SummaryRow title="Net Change in Cash" values={cashFlowStatement.netChangeInCash} isEditing={isEditing} />
                  </div>
              </div>
          ) : activeTab === 'aasb' ? (
              <AASBPreview 
                data={data}
                companyName={companyName}
                onGeneratePdf={handleDownloadAASBPdf}
                isGeneratingPdf={isGeneratingAASBPdf}
                isEditing={isEditing}
              />
          ) : (
              <VerificationCertificate certificate={verification} />
          )}
      </div>
    );
  } catch (error) {
    logger.error('Error rendering ReportDisplay component', {
      error: error instanceof Error ? error.message : 'Unknown error',
      activeTab,
      companyName
    });
    
    handleError('Failed to display report content', ErrorType.SYSTEM, { showToast: true });
    
    return (
      <div className="text-center max-w-2xl mx-auto mt-16 bg-red-100 border border-red-300 p-6 rounded-lg">
        <h3 className="text-2xl font-bold text-red-700 mb-2">Display Error</h3>
        <p className="text-red-600 mb-4">There was an error displaying the report. Please try refreshing the page.</p>
        <button
          onClick={onReset}
          className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg transition-transform transform hover:scale-105"
        >
          Start Over
        </button>
      </div>
    );
  }
};

export default ReportDisplay;