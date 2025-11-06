import React, { useState, useRef } from 'react';
import type { ReportData, VerificationResult } from '../types';
import { generateAudioSummary, generateOpenRouterAudioSummary } from '../services/geminiService';
import { generateAASBPdf } from '../services/pdfGenerator';

interface ReportDisplayProps {
  data: ReportData;
  verification: VerificationResult;
  onReset: () => void;
  apiConfig: {
    provider: 'gemini' | 'openrouter';
    apiKey: string;
    model: string;
    voiceModel: string;
  };
  companyName: string;
}

const ReportDisplay: React.FC<ReportDisplayProps> = ({ data, verification, onReset, apiConfig, companyName }) => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleGenerateAudio = async () => {
    setIsGeneratingAudio(true);
    try {
      const audioSummary = apiConfig.provider === 'openrouter' 
        ? await generateOpenRouterAudioSummary(data.summary, apiConfig.voiceModel)
        : await generateAudioSummary(data.summary, apiConfig.voiceModel);
      
      setAudioUrl(audioSummary);
    } catch (error) {
      console.error('Error generating audio:', error);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const pdfUrl = await generateAASBPdf(data, companyName);
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `${companyName.replace(/\s+/g, '_')}_Financial_Report_2025.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">{companyName} - 2025 Financial Report</h1>
        <div className="flex gap-4">
          <button
            onClick={handleGenerateAudio}
            disabled={isGeneratingAudio}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
          >
            {isGeneratingAudio ? 'Generating Audio...' : 'Generate Audio Summary'}
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isGeneratingPdf ? 'Generating PDF...' : 'Download PDF'}
          </button>
          <button
            onClick={onReset}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Generate New Report
          </button>
        </div>
      </div>

      {audioUrl && (
        <div className="mb-6 p-4 bg-green-50 rounded-lg">
          <h3 className="text-lg font-semibold text-green-800 mb-2">Audio Summary</h3>
          <audio ref={audioRef} controls className="w-full">
            <source src={audioUrl} type="audio/mpeg" />
            Your browser does not support the audio element.
          </audio>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Financial Report Summary</h2>
          <p className="text-gray-700 text-lg">{data.summary}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">Income Statement</h3>
            <div className="space-y-2 text-sm">
              <div>Total Revenue: ${data.incomeStatement.totalRevenue.toLocaleString()}</div>
              <div>Total Expenses: ${data.incomeStatement.totalExpenses.toLocaleString()}</div>
              <div>Net Income: ${data.incomeStatement.netIncome.toLocaleString()}</div>
              <div>Gross Profit Margin: {(data.incomeStatement.grossProfitMargin * 100).toFixed(1)}%</div>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-green-800 mb-2">Balance Sheet</h3>
            <div className="space-y-2 text-sm">
              <div>Total Assets: ${data.balanceSheet.totalAssets.toLocaleString()}</div>
              <div>Total Liabilities: ${data.balanceSheet.totalLiabilities.toLocaleString()}</div>
              <div>Shareholders Equity: ${data.balanceSheet.shareholdersEquity.toLocaleString()}</div>
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-purple-800 mb-2">Cash Flow</h3>
            <div className="space-y-2 text-sm">
              <div>Operating: ${data.cashFlow.operatingCashFlow.toLocaleString()}</div>
              <div>Investing: ${data.cashFlow.investingCashFlow.toLocaleString()}</div>
              <div>Financing: ${data.cashFlow.financingCashFlow.toLocaleString()}</div>
              <div>Net Cash Flow: ${data.cashFlow.netCashFlow.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Key Performance Indicators</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{data.keyMetrics.currentRatio.toFixed(2)}</div>
              <div className="text-sm text-gray-600">Current Ratio</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{data.keyMetrics.debtToEquity.toFixed(2)}</div>
              <div className="text-sm text-gray-600">Debt to Equity</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{(data.keyMetrics.returnOnEquity * 100).toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Return on Equity</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{(data.keyMetrics.profitMargin * 100).toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Profit Margin</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Strengths</h3>
            <ul className="space-y-2">
              {data.analysis.strengths.map((strength, index) => (
                <li key={index} className="flex items-center text-green-700">
                  <span className="mr-2">✓</span>
                  {strength}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Weaknesses</h3>
            <ul className="space-y-2">
              {data.analysis.weaknesses.map((weakness, index) => (
                <li key={index} className="flex items-center text-red-700">
                  <span className="mr-2">✗</span>
                  {weakness}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {verification.overallStatus === 'Failed' && (
          <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">Verification Issues</h3>
            <ul className="space-y-2">
              {verification.issues.map((issue, index) => (
                <li key={index} className="text-yellow-700">
                  <span className="font-medium">{issue.category}:</span> {issue.description}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="text-sm text-gray-500 text-center mt-8">
          Report generated on {new Date(data.dateGenerated).toLocaleDateString()} at {new Date(data.dateGenerated).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

export default ReportDisplay;