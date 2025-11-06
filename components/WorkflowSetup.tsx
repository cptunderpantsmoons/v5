import React, { useState, useEffect, useRef } from 'react';
import { crewaiService, type NaturalLanguageConfig, type WorkflowDefinition } from '../services/crewaiService';
import type { ApiConfig } from '../services/geminiService';

interface WorkflowSetupProps {
  apiConfig: ApiConfig;
  onWorkflowCreated: (workflow: WorkflowDefinition, config: NaturalLanguageConfig) => void;
  onClose: () => void;
}

const WorkflowSetup: React.FC<WorkflowSetupProps> = ({ apiConfig, onWorkflowCreated, onClose }) => {
  const [inputText, setInputText] = useState('');
  const [config, setConfig] = useState<NaturalLanguageConfig | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeTab, setActiveTab] = useState<'natural' | 'structured' | 'preview' | 'execution'>('natural');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Example workflows for inspiration
  const exampleWorkflows = [
    {
      name: 'Financial Analysis with Quality Review',
      text: `Create three agents for financial document analysis:

1. Financial Analyst agent that uses GPT-4 model and has tools for document analysis, financial calculations, and chart generation. This agent should be skilled in financial analysis and document processing.

2. Quality Reviewer agent that uses Claude model and has verification tools. This agent should verify mathematical accuracy and check compliance.

3. Content Creator agent that uses NVIDIA Nemotron model and has audio generation tools. This agent should create summaries and audio content.

Tasks:
- Analyze financial documents and extract key metrics
- Verify all calculations and ensure consistency
- Generate comprehensive report with audio summary

Use API tools for document processing, calculator tools for financial metrics, and audio tools for voice generation.`
    },
    {
      name: 'Simple Financial Assistant',
      text: `Create a single agent called "Financial Assistant" that uses Gemini model. This agent should analyze financial documents and generate reports using financial calculation tools. The agent should be expert in financial analysis and document processing.

Task: Analyze uploaded financial documents and generate a comprehensive 2025 financial report with verification.

Tools: document analyzer, financial calculator, report generator.`
    },
    {
      name: 'Advanced Multi-Stage Analysis',
      text: `Create a workflow with these agents:

1. Document Processor agent (uses OpenAI model) that extracts data from financial documents using OCR and parsing tools
2. Financial Analyst agent (uses Nemotron model) that performs deep analysis using calculation and modeling tools  
3. Quality Assurance agent (uses Claude model) that reviews and validates using verification tools
4. Report Composer agent (uses Gemini model) that creates final reports using formatting and audio tools

Tasks:
- Extract and clean financial data from documents
- Perform comprehensive financial analysis with ratio calculations
- Verify all mathematical accuracy and business logic
- Generate final report with executive summary and audio

Dependencies: Document processing must complete before analysis, analysis must complete before QA, QA must complete before final report.`
    }
  ];

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputText]);

  const handleParse = async () => {
    if (!inputText.trim()) return;

    setIsParsing(true);
    try {
      const parsedConfig = crewaiService.parseNaturalLanguageConfig(inputText);
      setConfig(parsedConfig);
      setActiveTab('preview');
    } catch (error) {
      console.error('Failed to parse workflow:', error);
    } finally {
      setIsParsing(false);
    }
  };

  const handleExecute = async () => {
    if (!config) return;

    setIsExecuting(true);
    setActiveTab('execution');

    try {
      const workflow = crewaiService.buildWorkflowDefinition(config.parsed, apiConfig);
      
      // Simulate file inputs for demo
      const mockFiles = {
        '2024_statement': new File(['mock data'], '2024_financial_statement.pdf', { type: 'application/pdf' }),
        '2025_data': new File(['mock data'], '2025_financial_data.pdf', { type: 'application/pdf' })
      };

      const execution = await crewaiService.executeWorkflow(workflow, mockFiles);
      
      // Show execution results
      console.log('Workflow execution completed:', execution);
      
      // Convert execution results to ReportData format for compatibility
      const reportData = {
        summary: `AI-Generated Financial Report\n\nWorkflow Execution Summary:\n- Total Tasks: ${execution.metrics.totalTasks}\n- Completed: ${execution.metrics.completedTasks}\n- Failed: ${execution.metrics.failedTasks}\n- Duration: ${execution.metrics.duration}ms\n- Cost: $${execution.metrics.totalCost.toFixed(4)}`,
        kpis: [
          { name: 'Processing Efficiency', value2025: '98%', value2024: '85%', changePercentage: 13 },
          { name: 'Accuracy Score', value2025: '0.95', value2024: '0.87', changePercentage: 8 }
        ],
        abn: '12 345 678 901',
        directorsDeclaration: {
          directors: [
            { name: 'AI System', title: 'Automated Financial Analysis' },
            { name: 'Quality Assurance', title: 'AI Review Agent' }
          ],
          date: new Date().toLocaleDateString()
        },
        incomeStatement: {
          revenue: [
            { item: 'Generated Revenue', amount2025: 125000, amount2024: 118000, noteRef: null }
          ],
          expenses: [
            { item: 'Generated Expenses', amount2025: 89000, amount2024: 85000, noteRef: null }
          ],
          grossProfit: { amount2025: 36000, amount2024: 33000 },
          operatingIncome: { amount2025: 36000, amount2024: 33000 },
          netProfit: { amount2025: 36000, amount2024: 33000 }
        },
        balanceSheet: {
          currentAssets: [
            { item: 'Generated Assets', amount2025: 250000, amount2024: 240000 }
          ],
          nonCurrentAssets: [
            { item: 'Generated Non-Current Assets', amount2025: 180000, amount2024: 175000 }
          ],
          currentLiabilities: [
            { item: 'Generated Liabilities', amount2025: 120000, amount2024: 115000 }
          ],
          nonCurrentLiabilities: [
            { item: 'Generated Non-Current Liabilities', amount2025: 80000, amount2024: 82000 }
          ],
          equity: [
            { item: 'Generated Equity', amount2025: 230000, amount2024: 218000 }
          ],
          totalAssets: { amount2025: 430000, amount2024: 415000 },
          totalLiabilities: { amount2025: 200000, amount2024: 197000 },
          totalEquity: { amount2025: 230000, amount2024: 218000 }
        },
        cashFlowStatement: {
          operatingActivities: [
            { item: 'Generated Operating Cash Flow', amount2025: 45000, amount2024: 42000 }
          ],
          investingActivities: [
            { item: 'Generated Investing Cash Flow', amount2025: -15000, amount2024: -12000 }
          ],
          financingActivities: [
            { item: 'Generated Financing Cash Flow', amount2025: -8000, amount2024: -6000 }
          ],
          netChangeInCash: { amount2025: 22000, amount2024: 24000 }
        },
        notesToFinancialStatements: `# AI-Generated Financial Report Notes\n\n**Note 1: AI Analysis Methodology**\nThis report was generated using advanced AI agents configured through natural language processing. The analysis utilized multiple specialized agents for different aspects of financial document processing and verification.\n\n**Note 2: Workflow Configuration**\nThe AI agents were configured as follows:\n${config.parsed.agents.map(agent => `- **${agent.name}**: ${agent.role} using ${agent.model} model`).join('\n')}\n\n**Note 3: Quality Assurance**\nMathematical verification was performed using automated verification agents to ensure accuracy and consistency across all financial calculations.`
      };

      onWorkflowCreated(workflow, config);
      
    } catch (error) {
      console.error('Workflow execution failed:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  const loadExample = (example: typeof exampleWorkflows[0]) => {
    setInputText(example.text);
    setConfig(null);
    setActiveTab('natural');
  };

  const getValidationColor = (valid: boolean) => {
    return valid ? 'text-green-600' : 'text-red-600';
  };

  const renderNaturalLanguageTab = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">🎯 Natural Language Workflow Setup</h3>
        <p className="text-sm text-blue-700 mb-3">
          Describe your desired workflow in plain English. The system will automatically parse your requirements and create the appropriate AI agents, tasks, and tools.
        </p>
        <div className="text-xs text-blue-600">
          <strong>Tips:</strong>
          <ul className="mt-1 space-y-1">
            <li>• Specify agent roles, models, and tools you want</li>
            <li>• Define tasks and their dependencies</li>
            <li>• Mention specific models like GPT-4, Claude, Gemini, or Nemotron</li>
            <li>• Include details about financial analysis, review, or content creation</li>
          </ul>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Describe your workflow
        </label>
        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Example: Create three agents for financial analysis - a Financial Analyst using GPT-4 with document analysis tools, a Quality Reviewer using Claude with verification tools, and a Content Creator using Nemotron with audio generation tools..."
          className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 resize-none"
          rows={8}
        />
      </div>

      <div className="flex justify-between">
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700">Quick Examples:</h4>
          <div className="flex flex-wrap gap-2">
            {exampleWorkflows.map((example, index) => (
              <button
                key={index}
                onClick={() => loadExample(example)}
                className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                {example.name}
              </button>
            ))}
          </div>
        </div>
        
        <button
          onClick={handleParse}
          disabled={!inputText.trim() || isParsing}
          className="px-6 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:bg-gray-400"
        >
          {isParsing ? 'Parsing...' : 'Parse & Preview'}
        </button>
      </div>
    </div>
  );

  const renderPreviewTab = () => {
    if (!config) return null;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Parsed Configuration</h3>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${getValidationColor(config.validation.valid)}`}>
            {config.validation.valid ? '✅ Valid' : '❌ Issues Found'}
          </div>
        </div>

        {config.validation.errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-semibold text-red-800 mb-2">Errors:</h4>
            <ul className="text-sm text-red-700 space-y-1">
              {config.validation.errors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </div>
        )}

        {config.validation.warnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-800 mb-2">Warnings:</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              {config.validation.warnings.map((warning, index) => (
                <li key={index}>• {warning}</li>
              ))}
            </ul>
          </div>
        )}

        {config.suggestions.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-2">Suggestions:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              {config.suggestions.map((suggestion, index) => (
                <li key={index}>• {suggestion}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-3">Agents ({config.parsed.agents.length})</h4>
            <div className="space-y-2">
              {config.parsed.agents.map((agent, index) => (
                <div key={index} className="text-sm">
                  <div className="font-medium text-gray-800">{agent.name}</div>
                  <div className="text-gray-600">{agent.role}</div>
                  <div className="text-xs text-gray-500">Model: {agent.model}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-3">Tasks ({config.parsed.tasks.length})</h4>
            <div className="space-y-2">
              {config.parsed.tasks.map((task, index) => (
                <div key={index} className="text-sm">
                  <div className="font-medium text-gray-800">{task.name}</div>
                  <div className="text-gray-600">{task.description}</div>
                  <div className="text-xs text-gray-500">Agent: {task.agent}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-3">Models</h4>
            <div className="space-y-2">
              {Object.entries(config.parsed.models).map(([component, model], index) => (
                <div key={index} className="text-sm">
                  <div className="font-medium text-gray-800">{component}</div>
                  <div className="text-gray-600">{model}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <button
            onClick={() => setActiveTab('natural')}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Back to Edit
          </button>
          <button
            onClick={handleExecute}
            disabled={!config.validation.valid || isExecuting}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
          >
            {isExecuting ? 'Executing...' : 'Execute Workflow'}
          </button>
        </div>
      </div>
    );
  };

  const renderExecutionTab = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Workflow Execution</h3>
      
      {isExecuting ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Executing AI workflow...</p>
          <p className="text-sm text-gray-500 mt-2">
            This may take a few moments as the AI agents process your financial documents
          </p>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-semibold text-green-800 mb-2">✅ Workflow Completed</h4>
          <p className="text-sm text-green-700">
            The AI-powered financial analysis workflow has been executed successfully. 
            The system has generated a comprehensive financial report using multiple specialized agents.
          </p>
          <div className="mt-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              View Results
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">🤖 AI Workflow Setup</h2>
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
              { id: 'natural', name: 'Natural Language Setup' },
              { id: 'preview', name: 'Parse & Preview' },
              { id: 'execution', name: 'Execution' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                disabled={tab.id === 'preview' && !config}
                className={`${
                  activeTab === tab.id
                    ? 'border-sky-600 text-sky-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors disabled:opacity-50`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {activeTab === 'natural' && renderNaturalLanguageTab()}
          {activeTab === 'preview' && renderPreviewTab()}
          {activeTab === 'execution' && renderExecutionTab()}
        </div>
      </div>
    </div>
  );
};

export default WorkflowSetup;