import { generateFinancialReport, fixFinancialReport, ApiConfig } from './geminiService';
import { verifyReportData } from './verificationService';
import jsPDF from 'jspdf';
import type { ReportData, VerificationResult } from './geminiService';
import type { ApiConfig as ApiConfigType } from './geminiService';

// Type definitions for CrewAI-like functionality
export interface Agent {
  id: string;
  name: string;
  role: string;
  goal: string;
  backstory: string;
  tools: Tool[];
  llm: ApiConfig;
  verbose: boolean;
  allow_delegation: boolean;
  max_iter: number;
  max_execution_time: number;
  memory: boolean;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'file' | 'array';
    description: string;
    required: boolean;
  }>;
  function: (params: any) => Promise<any>;
}

export interface Task {
  id: string;
  description: string;
  expected_output: string;
  agent: string;
  tools: string[];
  context: string;
}

export interface CrewAIConfig {
  agents: Agent[];
  tasks: Task[];
  max_workers: number;
  verbose: boolean;
  memory_enabled: boolean;
}

declare global {
  var GoogleGenerativeAI: any;
  var google: {
    generativeai: {
      GoogleGenerativeAI: any;
    };
  };
  var XLSX: any;
}

// CrewAI Service class for orchestrating AI agents
export class CrewAIService {
  public name: string; // Fixed: made public and explicitly defined
  private config: CrewAIConfig;
  private results: Map<string, any> = new Map();
  private memory: Map<string, any> = new Map();

  constructor(config: CrewAIConfig, name: string = 'CrewAIService') {
    this.name = name; // Fixed: initialize the name property
    this.config = config;
  }

  async execute(): Promise<Map<string, any>> {
    console.log(`🚀 Starting CrewAI execution: ${this.name}`);
    
    // Execute tasks in logical order based on dependencies
    const completedTasks = new Set<string>();
    const maxIterations = 10;
    let currentIteration = 0;

    while (completedTasks.size < this.config.tasks.length && currentIteration < maxIterations) {
      currentIteration++;
      let progress = false;

      for (const task of this.config.tasks) {
        if (completedTasks.has(task.id)) continue;
        
        if (this.canExecuteTask(task, completedTasks)) {
          console.log(`📋 Executing task: ${task.description}`);
          
          const result = await this.executeTask(task);
          this.results.set(task.id, result);
          completedTasks.add(task.id);
          progress = true;
          
          // Store in memory if enabled
          if (this.config.memory_enabled) {
            this.memory.set(task.id, result);
          }
        }
      }

      if (!progress) {
        console.warn('⚠️ No tasks could be executed, breaking loop');
        break;
      }
    }

    return this.results;
  }

  private canExecuteTask(task: Task, completedTasks: Set<string>): boolean {
    // For now, allow all tasks to execute (can be enhanced with dependency checking)
    return true;
  }

  private async executeTask(task: Task): Promise<any> {
    const agent = this.config.agents.find(a => a.id === task.agent);
    if (!agent) {
      throw new Error(`Agent ${task.agent} not found for task ${task.id}`);
    }

    console.log(`🤖 Agent ${agent.name} executing: ${task.description}`);
    
    // Apply tools if specified
    for (const toolName of task.tools) {
      const tool = agent.tools.find(t => t.name === toolName);
      if (tool) {
        console.log(`🔧 Using tool: ${tool.name}`);
        const toolResult = await tool.function({ task: task.description, context: task.context });
        console.log(`✅ Tool result:`, toolResult);
      }
    }

    // Simulate task completion based on agent type
    return await this.simulateAgentTask(agent, task);
  }

  private async simulateAgentTask(agent: Agent, task: Task): Promise<any> {
    // Different simulation based on agent role
    await this.delay(1000); // Simulate processing time

    switch (agent.role.toLowerCase()) {
      case 'financial document specialist':
        return {
          taskId: task.id,
          type: 'document_analysis',
          result: 'Document analysis completed',
          extracted_data: { key_metrics: [], tables: [] },
          timestamp: new Date().toISOString()
        };
        
      case 'financial report writer':
        return {
          taskId: task.id,
          type: 'report_generation',
          result: 'Report generated successfully',
          report_data: { sections: [], summary: '' },
          timestamp: new Date().toISOString()
        };
        
      case 'financial quality assurance':
        return {
          taskId: task.id,
          type: 'quality_verification',
          result: 'Quality verification completed',
          verification_status: 'passed',
          discrepancies: [],
          timestamp: new Date().toISOString()
        };
        
      default:
        return {
          taskId: task.id,
          description: task.description,
          result: `Task completed by ${agent.name}`,
          timestamp: new Date().toISOString(),
          agent: agent.name
        };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getResults(): Map<string, any> {
    return this.results;
  }

  getMemory(): Map<string, any> {
    return this.memory;
  }

  // Utility logging method
  log: (message: string, level?: string) => void = (message: string, level: string = 'info') => {
    console.log(`[${level.toUpperCase()}] ${this.name}: ${message}`); // Fixed: this.name is now properly defined
  };
}

// Tool definitions for financial report generation
export const createFinancialTools = (): Tool[] => [
  {
    name: 'document_analyzer',
    description: 'Analyzes financial documents and extracts key information',
    parameters: [
      { name: 'document', type: 'file', description: 'Document file to analyze', required: true },
      { name: 'analysis_type', type: 'string', description: 'Type of analysis to perform', required: false }
    ],
    function: async (params: any) => {
      // Simulate document analysis
      return {
        success: true,
        extracted_data: {
          revenue: 1000000,
          expenses: 800000,
          profit: 200000
        },
        analysis_type: params.analysis_type || 'standard'
      };
    }
  },
  {
    name: 'report_generator',
    description: 'Generates structured financial reports',
    parameters: [
      { name: 'data', type: 'array', description: 'Financial data to include in report', required: true }, // Fixed: 'object' -> 'array'
      { name: 'template', type: 'string', description: 'Report template to use', required: false }
    ],
    function: async (params: any) => {
      // Simulate report generation
      const report = new jsPDF();
      report.text('Financial Report', 10, 10);
      report.text(`Generated: ${new Date().toLocaleDateString()}`, 10, 20);
      
      if (params.data) {
        report.text(`Revenue: $${params.data[0]?.revenue?.toLocaleString() || 'N/A'}`, 10, 40);
        report.text(`Expenses: $${params.data[0]?.expenses?.toLocaleString() || 'N/A'}`, 10, 50);
        report.text(`Profit: $${params.data[0]?.profit?.toLocaleString() || 'N/A'}`, 10, 60);
      }
      
      return {
        success: true,
        report_content: report.output('datauristring'),
        template_used: params.template || 'standard'
      };
    }
  },
  {
    name: 'data_verifier',
    description: 'Verifies data consistency and accuracy',
    parameters: [
      { name: 'report_data', type: 'array', description: 'Report data to verify', required: true }, // Fixed: 'object' -> 'array'
      { name: 'validation_rules', type: 'array', description: 'Specific validation rules to apply', required: false }
    ],
    function: async (params: any) => {
      // Simulate data verification
      const verification = {
        success: true,
        is_consistent: true,
        errors_found: [],
        warnings: [],
        validation_rules_applied: params.validation_rules?.length || 0
      };

      // Simulate finding some validation issues
      if (params.report_data && (!params.report_data || params.report_data.length === 0)) {
        verification.warnings.push('Missing report data validation');
      }

      return verification;
    }
  }
];

// Predefined agent configurations
export const createFinancialReportAgents = (llmConfig: ApiConfig): Agent[] => [
  {
    id: 'document-analyzer',
    name: 'Document Analyzer',
    role: 'Financial Document Specialist',
    goal: 'Extract and analyze financial data from uploaded documents',
    backstory: 'Expert in parsing financial statements, balance sheets, and income statements with advanced OCR and data extraction capabilities.',
    tools: createFinancialTools().filter(t => t.name === 'document_analyzer'),
    llm: llmConfig,
    verbose: true,
    allow_delegation: false,
    max_iter: 3,
    max_execution_time: 300,
    memory: true
  },
  {
    id: 'report-generator',
    name: 'Report Generator',
    role: 'Financial Report Writer',
    goal: 'Generate comprehensive and accurate financial reports',
    backstory: 'Senior accountant with expertise in financial reporting standards and regulatory compliance.',
    tools: createFinancialTools().filter(t => t.name === 'report_generator'),
    llm: llmConfig,
    verbose: true,
    allow_delegation: true,
    max_iter: 5,
    max_execution_time: 600,
    memory: true
  },
  {
    id: 'quality-verifier',
    name: 'Quality Verifier',
    role: 'Financial Quality Assurance',
    goal: 'Verify mathematical accuracy and data consistency',
    backstory: 'Expert auditor with deep knowledge of financial verification and validation processes.',
    tools: createFinancialTools().filter(t => t.name === 'data_verifier'),
    llm: llmConfig,
    verbose: true,
    allow_delegation: false,
    max_iter: 2,
    max_execution_time: 300,
    memory: true
  }
];

// Create default financial report configuration
export const createDefaultFinancialConfig = (llmConfig: ApiConfig): CrewAIConfig => {
  return {
    agents: createFinancialReportAgents(llmConfig),
    tasks: [
      {
        id: 'analyze-2024-docs',
        description: 'Analyze 2024 financial documents and extract key information',
        expected_output: 'Structured data from 2024 financial statements',
        agent: 'document-analyzer',
        tools: ['document_analyzer'],
        context: '2024 financial documents'
      },
      {
        id: 'analyze-2025-docs',
        description: 'Analyze 2025 financial documents and extract current data',
        expected_output: 'Structured data from 2025 financial statements',
        agent: 'document-analyzer',
        tools: ['document_analyzer'],
        context: '2025 financial documents'
      },
      {
        id: 'generate-report',
        description: 'Generate comprehensive 2025 financial report based on analyzed data',
        expected_output: 'Complete financial report in specified format',
        agent: 'report-generator',
        tools: ['report_generator'],
        context: 'Combined data from both years'
      },
      {
        id: 'verify-report',
        description: 'Verify mathematical accuracy and consistency of generated report',
        expected_output: 'Verification report with any corrections needed',
        agent: 'quality-verifier',
        tools: ['data_verifier'],
        context: 'Generated financial report'
      }
    ],
    max_workers: 3,
    verbose: true,
    memory_enabled: true
  };
};

// Utility function to execute financial report generation
export const executeFinancialReportGeneration = async (
  file2024: File,
  file2025: File,
  companyName: string,
  apiConfig: ApiConfig
): Promise<ReportData> => {
  const config = createDefaultFinancialConfig(apiConfig);
  const crew = new CrewAIService(config, `Financial Report Generator for ${companyName}`);
  
  try {
    const results = await crew.execute();
    console.log('CrewAI Results:', results);
    
    // Convert CrewAI results to standard report format
    // For now, fall back to the standard generation method
    return await generateFinancialReport(file2024, file2025, apiConfig);
  } catch (error) {
    console.error('CrewAI execution failed, falling back to standard generation:', error);
    return await generateFinancialReport(file2024, file2025, apiConfig);
  }
};