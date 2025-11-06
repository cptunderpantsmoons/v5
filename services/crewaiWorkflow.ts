import type { ReportData, VerificationResult, ApiConfig } from './geminiService';

// CrewAI-style Agent definitions
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
  parameters: any;
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

export interface Workflow {
  id: string;
  name: string;
  description: string;
  agents: Agent[];
  tasks: Task[];
  dependencies: { [key: string]: string[] };
  config: WorkflowConfig;
}

export interface WorkflowConfig {
  parallel_execution: boolean;
  max_workers: number;
  memory_enabled: boolean;
  tool_timeout: number;
  error_handling: 'continue' | 'stop' | 'retry';
  max_retries: number;
}

// Natural Language to Agent Converter
export class NaturalLanguageAgentConfig {
  static parseAgentDescription(description: string): Partial<Agent> {
    const agentConfig: Partial<Agent> = {
      id: this.generateId(description),
      name: this.extractName(description),
      role: this.extractRole(description),
      goal: this.extractGoal(description),
      backstory: this.extractBackstory(description),
      tools: this.extractTools(description),
      llm: this.extractModelConfig(description),
      verbose: this.extractVerbose(description),
      allow_delegation: this.extractDelegation(description),
      max_iter: this.extractMaxIter(description),
      max_execution_time: this.extractMaxTime(description),
      memory: this.extractMemory(description)
    };

    return agentConfig;
  }

  private static generateId(description: string): string {
    return description.toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') + '-' + Date.now();
  }

  private static extractName(description: string): string {
    const namePatterns = [
      /(?:called|named|for)\s+([A-Z][a-zA-Z\s]+?)(?:\s|,|\.|$)/i,
      /agent\s+([A-Z][a-zA-Z\s]+?)(?:\s|,|\.|$)/i,
      /create\s+(?:a\s+)?([A-Z][a-zA-Z\s]+?)\s+agent/i
    ];

    for (const pattern of namePatterns) {
      const match = description.match(pattern);
      if (match) return match[1].trim();
    }

    return 'Unnamed Agent';
  }

  private static extractRole(description: string): string {
    const rolePatterns = [
      /(?:role|position)\s*(?:is|:)\s*([^.!?]+)/i,
      /should\s+([^.!?]+)/i,
      /(?:specializes?|responsible)\s+for\s+([^.!?]+)/i
    ];

    for (const pattern of rolePatterns) {
      const match = description.match(pattern);
      if (match) return match[1].trim();
    }

    return 'Specialized AI agent';
  }

  private static extractGoal(description: string): string {
    const goalPatterns = [
      /(?:goal|objective|purpose)\s*(?:is|:)\s*([^.!?]+)/i,
      /to\s+([^.!?]+?)(?:\s|$|\.)/i,
      /ensure\s+([^.!?]+)/i
    ];

    for (const pattern of goalPatterns) {
      const match = description.match(pattern);
      if (match) return match[1].trim();
    }

    return 'Complete assigned tasks efficiently and accurately.';
  }

  private static extractBackstory(description: string): string {
    const backstoryPatterns = [
      /(?:background|experience|expertise)\s*(?:is|:)\s*([^.!?]+)/i,
      /with\s+([^.!?]+?)(?:\s|,|\.|$)/i,
      /(?:trained|designed)\s+(?:to\s+)?([^.!?]+)/i
    ];

    for (const pattern of backstoryPatterns) {
      const match = description.match(pattern);
      if (match) return match[1].trim();
    }

    return 'An experienced AI agent with expertise in financial analysis and document processing.';
  }

  private static extractTools(description: string): Tool[] {
    const tools: Tool[] = [];
    
    // Extract tool mentions
    const toolMentions = description.match(/(?:using|with|via)\s+([a-zA-Z\s]+?)(?:\s|,|\.|$)/gi) || [];
    
    toolMentions.forEach(mention => {
      const toolName = mention.replace(/(?:using|with|via)\s+/i, '').trim();
      if (toolName.length > 2) {
        tools.push({
          name: toolName.toLowerCase().replace(/\s+/g, '_'),
          description: `Tool for ${toolName}`,
          parameters: {},
          function: async () => ({ message: `${toolName} functionality not implemented` })
        });
      }
    });

    // Add default financial analysis tools
    if (tools.length === 0) {
      tools.push(
        {
          name: 'document_analyzer',
          description: 'Analyzes financial documents and extracts key information',
          parameters: { document: 'string' },
          function: async (params: any) => ({ analysis: 'Document analyzed' })
        },
        {
          name: 'calculator',
          description: 'Performs financial calculations and verifications',
          parameters: { expression: 'string' },
          function: async (params: any) => ({ result: 0 })
        }
      );
    }

    return tools;
  }

  private static extractModelConfig(description: string): ApiConfig {
    // Extract model preferences from description
    const modelPatterns = [
      /(?:model|llm|using)\s+(?:should\s+)?(?:be\s+)?([a-zA-Z0-9\-\/]+)/i,
      /(?:gemini|claude|gpt|openai|anthropic)/i
    ];

    let model = 'gemini-2.5-flash';
    let provider: 'gemini' | 'openrouter' = 'gemini';

    for (const pattern of modelPatterns) {
      const match = description.match(pattern);
      if (match) {
        const modelStr = match[1] || match[0];
        if (modelStr.includes('/')) {
          model = modelStr;
          provider = 'openrouter';
        } else {
          model = modelStr;
        }
        break;
      }
    }

    return {
      provider,
      apiKey: '',
      model,
      voiceModel: 'elevenlabs/eleven-multilingual-v2'
    };
  }

  private static extractVerbose(description: string): boolean {
    return description.toLowerCase().includes('verbose') || 
           description.toLowerCase().includes('detailed output');
  }

  private static extractDelegation(description: string): boolean {
    return description.toLowerCase().includes('delegate') || 
           description.toLowerCase().includes('can delegate tasks');
  }

  private static extractMaxIter(description: string): number {
    const match = description.match(/(\d+)\s*(?:iterations?|times?)/i);
    return match ? parseInt(match[1]) : 3;
  }

  private static extractMaxTime(description: string): number {
    const match = description.match(/(\d+)\s*(?:minutes?|seconds?|hours?)/i);
    if (!match) return 300; // 5 minutes default
    
    const value = parseInt(match[1]);
    const unit = match[0].toLowerCase();
    
    if (unit.includes('hour')) return value * 3600;
    if (unit.includes('minute')) return value * 60;
    return value;
  }

  private static extractMemory(description: string): boolean {
    return description.toLowerCase().includes('memory') || 
           description.toLowerCase().includes('remember');
  }
}

// Workflow Execution Engine
export class CrewAIWorkflowEngine {
  private workflow: Workflow;
  private results: Map<string, any> = new Map();
  private memory: Map<string, any> = new Map();

  constructor(workflow: Workflow) {
    this.workflow = workflow;
  }

  async execute(): Promise<Map<string, any>> {
    console.log(`🚀 Starting workflow: ${this.workflow.name}`);
    
    if (this.workflow.config.parallel_execution) {
      return this.executeParallel();
    } else {
      return this.executeSequential();
    }
  }

  private async executeSequential(): Promise<Map<string, any>> {
    const completedTasks = new Set<string>();
    const maxIterations = 10;
    let currentIteration = 0;

    while (completedTasks.size < this.workflow.tasks.length && currentIteration < maxIterations) {
      currentIteration++;
      let progress = false;

      for (const task of this.workflow.tasks) {
        if (completedTasks.has(task.id)) continue;
        
        if (this.canExecuteTask(task, completedTasks)) {
          console.log(`📋 Executing task: ${task.description}`);
          
          const result = await this.executeTask(task);
          this.results.set(task.id, result);
          completedTasks.add(task.id);
          progress = true;
          
          // Store in memory if enabled
          if (this.workflow.config.memory_enabled) {
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

  private async executeParallel(): Promise<Map<string, any>> {
    const readyTasks = this.workflow.tasks.filter(task => 
      this.canExecuteTask(task, new Set())
    );

    const promises = readyTasks.map(task => this.executeTask(task));
    const results = await Promise.all(promises);
    
    results.forEach((result, index) => {
      this.results.set(readyTasks[index].id, result);
    });

    return this.results;
  }

  private canExecuteTask(task: Task, completedTasks: Set<string>): boolean {
    // Check dependencies
    const dependencies = this.workflow.dependencies[task.id] || [];
    return dependencies.every(dep => completedTasks.has(dep));
  }

  private async executeTask(task: Task): Promise<any> {
    const agent = this.workflow.agents.find(a => a.id === task.agent);
    if (!agent) {
      throw new Error(`Agent ${task.agent} not found for task ${task.id}`);
    }

    console.log(`🤖 Agent ${agent.name} executing: ${task.description}`);
    
    // Simulate agent execution
    await this.delay(1000); // Simulate processing time

    // Apply tools if specified
    for (const toolName of task.tools) {
      const tool = agent.tools.find(t => t.name === toolName);
      if (tool) {
        console.log(`🔧 Using tool: ${tool.name}`);
        const toolResult = await tool.function({ task: task.description });
        console.log(`✅ Tool result:`, toolResult);
      }
    }

    // Simulate task completion
    return {
      taskId: task.id,
      description: task.description,
      result: `Task completed by ${agent.name}`,
      timestamp: new Date().toISOString(),
      agent: agent.name
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Predefined Financial Report Workflow
export function createFinancialReportWorkflow(): Workflow {
  return {
    id: 'financial-report-workflow',
    name: 'Financial Report Generation Workflow',
    description: 'Comprehensive workflow for generating and verifying financial reports using multiple AI agents',
    agents: [
      {
        id: 'document-analyzer',
        name: 'Document Analyzer Agent',
        role: 'Financial Document Specialist',
        goal: 'Analyze and extract key information from financial documents',
        backstory: 'Expert in parsing financial statements, balance sheets, and income statements with 10+ years of experience.',
        tools: [
          {
            name: 'document_parser',
            description: 'Parses various document formats (PDF, Excel, images)',
            parameters: { file: 'File', format: 'string' },
            function: async (params: any) => ({ parsed: true, content: 'Document parsed' })
          },
          {
            name: 'financial_extractor',
            description: 'Extracts financial data and figures',
            parameters: { document: 'Object', type: 'string' },
            function: async (params: any) => ({ extracted: true, data: {} })
          }
        ],
        llm: {
          provider: 'openrouter',
          apiKey: '',
          model: 'nvidia/nemotron-nano-12b-v2-vl',
          voiceModel: 'elevenlabs/eleven-multilingual-v2'
        },
        verbose: true,
        allow_delegation: false,
        max_iter: 3,
        max_execution_time: 300,
        memory: true
      },
      {
        id: 'report-generator',
        name: 'Financial Report Generator',
        role: 'Financial Report Writer',
        goal: 'Generate comprehensive and accurate financial reports',
        backstory: 'Senior accountant with expertise in financial reporting standards and regulatory compliance.',
        tools: [
          {
            name: 'report_builder',
            description: 'Builds structured financial reports',
            parameters: { data: 'Object', template: 'string' },
            function: async (params: any) => ({ report: 'Generated report' })
          },
          {
            name: 'data_validator',
            description: 'Validates financial data consistency',
            parameters: { data: 'Object' },
            function: async (params: any) => ({ valid: true })
          }
        ],
        llm: {
          provider: 'openrouter',
          apiKey: '',
          model: 'anthropic/claude-3.5-sonnet',
          voiceModel: 'elevenlabs/eleven-multilingual-v2'
        },
        verbose: true,
        allow_delegation: true,
        max_iter: 5,
        max_execution_time: 600,
        memory: true
      },
      {
        id: 'quality-verifier',
        name: 'Quality Verification Agent',
        role: 'Financial Quality Assurance',
        goal: 'Verify mathematical accuracy and data consistency',
        backstory: 'Expert auditor with deep knowledge of financial verification and validation processes.',
        tools: [
          {
            name: 'math_verifier',
            description: 'Verifies mathematical calculations',
            parameters: { calculations: 'Array' },
            function: async (params: any) => ({ verified: true })
          },
          {
            name: 'consistency_checker',
            description: 'Checks data consistency across reports',
            parameters: { reports: 'Array' },
            function: async (params: any) => ({ consistent: true })
          }
        ],
        llm: {
          provider: 'openrouter',
          apiKey: '',
          model: 'openai/gpt-4o',
          voiceModel: 'elevenlabs/eleven-multilingual-v2'
        },
        verbose: true,
        allow_delegation: false,
        max_iter: 2,
        max_execution_time: 300,
        memory: true
      }
    ],
    tasks: [
      {
        id: 'analyze-2024-docs',
        description: 'Analyze 2024 financial documents and extract key information',
        expected_output: 'Structured data from 2024 financial statements',
        agent: 'document-analyzer',
        tools: ['document_parser', 'financial_extractor'],
        context: '2024 financial documents'
      },
      {
        id: 'analyze-2025-docs',
        description: 'Analyze 2025 financial documents and extract current data',
        expected_output: 'Structured data from 2025 financial statements',
        agent: 'document-analyzer',
        tools: ['document_parser', 'financial_extractor'],
        context: '2025 financial documents'
      },
      {
        id: 'generate-report',
        description: 'Generate comprehensive 2025 financial report based on analyzed data',
        expected_output: 'Complete financial report in specified format',
        agent: 'report-generator',
        tools: ['report_builder', 'data_validator'],
        context: 'Combined data from both years'
      },
      {
        id: 'verify-report',
        description: 'Verify mathematical accuracy and consistency of generated report',
        expected_output: 'Verification report with any corrections needed',
        agent: 'quality-verifier',
        tools: ['math_verifier', 'consistency_checker'],
        context: 'Generated financial report'
      }
    ],
    dependencies: {
      'generate-report': ['analyze-2024-docs', 'analyze-2025-docs'],
      'verify-report': ['generate-report']
    },
    config: {
      parallel_execution: true,
      max_workers: 3,
      memory_enabled: true,
      tool_timeout: 300,
      error_handling: 'retry',
      max_retries: 3
    }
  };
}