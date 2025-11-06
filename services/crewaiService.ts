import type { ApiConfig } from './geminiService';
import type { ReportData, VerificationResult } from '../types';

// Types for CrewAI integration
export interface AgentRole {
  name: string;
  description: string;
  goal: string;
  backstory: string;
  tools: ToolDefinition[];
  llm: ModelConfig;
}

export interface Task {
  description: string;
  agent: string;
  expected_output: string;
  context?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  function: string;
  model?: ModelConfig;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'file' | 'array';
  description: string;
  required: boolean;
}

export interface ModelConfig {
  provider: 'gemini' | 'openrouter';
  model: string;
  apiKey?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface WorkflowDefinition {
  name: string;
  description: string;
  agents: AgentRole[];
  tasks: Task[];
  tools: ToolDefinition[];
  models: Record<string, ModelConfig>;
  dependencies: string[];
}

export interface NaturalLanguageConfig {
  rawText: string;
  parsed: ParsedWorkflow;
  suggestions: string[];
  validation: ValidationResult;
}

export interface ParsedWorkflow {
  agents: ParsedAgent[];
  tasks: ParsedTask[];
  tools: ParsedTool[];
  models: Record<string, string>;
}

export interface ParsedAgent {
  name: string;
  role: string;
  description: string;
  tools: string[];
  model: string;
  expertise: string[];
}

export interface ParsedTask {
  name: string;
  description: string;
  agent: string;
  prerequisites: string[];
  output: string;
}

export interface ParsedTool {
  name: string;
  type: 'api' | 'file' | 'calculation' | 'analysis' | 'visualization';
  description: string;
  parameters: string[];
  implementation: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missing: string[];
}

export interface CrewExecution {
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  agents: Map<string, any>;
  tasks: Task[];
  results: Map<string, any>;
  logs: ExecutionLog[];
  metrics: ExecutionMetrics;
}

export interface ExecutionLog {
  timestamp: string;
  agent: string;
  task: string;
  message: string;
  level: 'info' | 'warning' | 'error' | 'success';
  data?: any;
}

export interface ExecutionMetrics {
  startTime: Date;
  endTime?: Date;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalCost: number;
  tokensUsed: number;
  duration?: number;
}

declare global {
  var google: {
    generativeai: {
      GoogleGenerativeAI: any;
    };
  };
}

class CrewAIService {
  private agentPool: Map<string, any> = new Map();
  private toolRegistry: Map<string, any> = new Map();
  private executionStore: Map<string, CrewExecution> = new Map();
  private modelConfigs: Map<string, ModelConfig> = new Map();

  // Natural Language Processing for Workflow Configuration
  parseNaturalLanguageConfig(text: string): NaturalLanguageConfig {
    const lowerText = text.toLowerCase();
    const parsed: ParsedWorkflow = {
      agents: [],
      tasks: [],
      tools: [],
      models: {}
    };

    const suggestions: string[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Parse agents
      this.parseAgents(lowerText, parsed, errors, warnings);
      
      // Parse tasks  
      this.parseTasks(lowerText, parsed, errors, warnings);
      
      // Parse tools
      this.parseTools(lowerText, parsed, errors, warnings);
      
      // Parse models
      this.parseModels(lowerText, parsed, errors, warnings);

      // Generate suggestions based on parsed content
      this.generateSuggestions(parsed, suggestions);

    } catch (error) {
      errors.push(`Failed to parse natural language: ${error}`);
    }

    return {
      rawText: text,
      parsed,
      suggestions,
      validation: {
        valid: errors.length === 0,
        errors,
        warnings,
        missing: this.findMissingComponents(parsed)
      }
    };
  }

  private parseAgents(text: string, parsed: ParsedWorkflow, errors: string[], warnings: string[]) {
    // Pattern matching for agent definitions
    const agentPatterns = [
      /agent:\s*([a-zA-Z0-9\s]+)\s+(?:as|role|plays)\s+([a-zA-Z0-9\s]+)\s+(?:that|who)\s+(.+?)(?=agent:|$)/g,
      /create\s+(?:an?\s+)?agent\s+(?:named\s+)?([a-zA-Z0-9\s]+)\s+(?:as|for)\s+([a-zA-Z0-9\s]+)\s+(?:that|who)\s+(.+?)(?=\.|$)/g
    ];

    agentPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1].trim();
        const role = match[2].trim();
        const description = match[3].trim();

        if (name && role && description) {
          parsed.agents.push({
            name,
            role,
            description,
            tools: this.extractTools(text, name),
            model: this.extractModel(text, name),
            expertise: this.extractExpertise(text, role)
          });
        } else {
          errors.push(`Incomplete agent definition: ${match[0]}`);
        }
      }
    });

    // If no agents found, try to extract from context
    if (parsed.agents.length === 0) {
      this.extractAgentsFromContext(text, parsed, warnings);
    }
  }

  private parseTasks(text: string, parsed: ParsedWorkflow, errors: string[], warnings: string[]) {
    // Pattern matching for task definitions
    const taskPatterns = [
      /task:\s*([a-zA-Z0-9\s]+)\s+(?:is|to|should)\s+(.+?)(?=task:|$)/g,
      /create\s+task\s+(?:named\s+)?([a-zA-Z0-9\s]+)\s+(?:that|to)\s+(.+?)(?=\.|$)/g,
      /([a-zA-Z0-9\s]+)\s+(?:task|should|must)\s+(.+?)(?=task:|$)/g
    ];

    taskPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1].trim();
        const description = match[2].trim();

        if (name && description) {
          parsed.tasks.push({
            name,
            description,
            agent: this.findBestAgent(parsed.agents, description) || 'coordinator',
            prerequisites: this.extractPrerequisites(text, name),
            output: this.extractExpectedOutput(description)
          });
        } else {
          errors.push(`Incomplete task definition: ${match[0]}`);
        }
      }
    });
  }

  private parseTools(text: string, parsed: ParsedWorkflow, errors: string[], warnings: string[]) {
    // Pattern matching for tool definitions
    const toolPatterns = [
      /tool:\s*([a-zA-Z0-9]+)\s+(?:that|to|for)\s+(.+?)(?=tool:|$)/g,
      /create\s+tool\s+(?:named\s+)?([a-zA-Z0-9]+)\s+(?:that|to)\s+(.+?)(?=\.|$)/g
    ];

    toolPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1].trim();
        const description = match[2].trim();

        if (name && description) {
          parsed.tools.push({
            name,
            type: this.determineToolType(description),
            description,
            parameters: this.extractParameters(description),
            implementation: this.suggestImplementation(description)
          });
        } else {
          errors.push(`Incomplete tool definition: ${match[0]}`);
        }
      }
    });
  }

  private parseModels(text: string, parsed: ParsedWorkflow, errors: string[], warnings: string[]) {
    // Pattern matching for model configurations
    const modelPatterns = [
      /use\s+([a-zA-Z0-9/.-]+)\s+(?:model|for)\s+([a-zA-Z0-9\s]+)/g,
      /([a-zA-Z0-9\s]+)\s+(?:should\s+)?use\s+([a-zA-Z0-9/.-]+)\s+(?:model|ai)/g
    ];

    modelPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const component = match[1].trim();
        const model = match[2].trim();

        if (component && model) {
          parsed.models[component] = model;
        }
      }
    });
  }

  private extractTools(text: string, agentName: string): string[] {
    const tools: string[] = [];
    
    // Look for tool mentions near agent name
    const agentContext = this.extractContext(text, agentName);
    const toolMentions = agentContext.match(/using\s+(?:tools?\s+)?([^.]+)/gi);
    
    if (toolMentions) {
      toolMentions.forEach(mention => {
        const toolsText = mention.replace(/using\s+(?:tools?\s+)?/i, '').trim();
        const toolList = toolsText.split(/[,&]|\s+and\s+/i).map(t => t.trim());
        tools.push(...toolList.filter(t => t.length > 0));
      });
    }

    return [...new Set(tools)]; // Remove duplicates
  }

  private extractModel(text: string, agentName: string): string {
    // Look for model mentions near agent name
    const agentContext = this.extractContext(text, agentName);
    const modelMatch = agentContext.match(/using\s+([a-zA-Z0-9/.-]+)/i);
    return modelMatch ? modelMatch[1] : 'gemini-2.5-flash';
  }

  private extractExpertise(text: string, role: string): string[] {
    const expertise: string[] = [];
    
    // Extract skills and expertise from role description
    const skillsPattern = /(?:skilled|expert|proficient)\s+in\s+([^.]+)/i;
    const skillsMatch = text.match(skillsPattern);
    
    if (skillsMatch) {
      expertise.push(...skillsMatch[1].split(/[,&]|\s+and\s+/i).map(s => s.trim()));
    }

    // Add role-based expertise
    if (role.toLowerCase().includes('analysis')) {
      expertise.push('data analysis', 'financial modeling');
    }
    if (role.toLowerCase().includes('review')) {
      expertise.push('quality assurance', 'validation');
    }
    if (role.toLowerCase().includes('generation')) {
      expertise.push('content creation', 'text generation');
    }

    return [...new Set(expertise)];
  }

  private findBestAgent(agents: ParsedAgent[], taskDescription: string): string {
    // Find the most suitable agent for a task based on description
    const taskWords = taskDescription.toLowerCase().split(/\s+/);
    
    let bestAgent = agents[0]?.name || 'coordinator';
    let bestScore = 0;

    agents.forEach(agent => {
      let score = 0;
      const agentWords = `${agent.role} ${agent.description} ${agent.expertise.join(' ')}`.toLowerCase();
      
      taskWords.forEach(word => {
        if (agentWords.includes(word)) {
          score++;
        }
      });

      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent.name;
      }
    });

    return bestAgent;
  }

  private extractPrerequisites(text: string, taskName: string): string[] {
    // Look for task dependencies
    const dependsMatch = text.match(new RegExp(`${taskName}.*?(?:after|before|depends on)\\s+([^.]+)`, 'i'));
    return dependsMatch ? dependsMatch[1].split(/[,&]|\s+and\s+/i).map(p => p.trim()) : [];
  }

  private extractExpectedOutput(description: string): string {
    // Extract expected output from task description
    const outputPatterns = [
      /(?:output|result|return)\s+([^.]+)/i,
      /(?:should|must)\s+(?:generate|create|provide)\s+([^.]+)/i
    ];

    for (const pattern of outputPatterns) {
      const match = description.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return 'Detailed analysis and recommendations';
  }

  private determineToolType(description: string): ParsedTool['type'] {
    const desc = description.toLowerCase();
    
    if (desc.includes('api') || desc.includes('fetch') || desc.includes('request')) {
      return 'api';
    } else if (desc.includes('file') || desc.includes('read') || desc.includes('write')) {
      return 'file';
    } else if (desc.includes('calculate') || desc.includes('compute') || desc.includes('formula')) {
      return 'calculation';
    } else if (desc.includes('analyze') || desc.includes('examine') || desc.includes('review')) {
      return 'analysis';
    } else if (desc.includes('chart') || desc.includes('graph') || desc.includes('visualize')) {
      return 'visualization';
    }

    return 'analysis'; // Default
  }

  private extractParameters(description: string): string[] {
    // Extract parameter names from description
    const paramMatches = description.match(/\{([^}]+)\}/g);
    if (paramMatches) {
      return paramMatches.map(p => p.slice(1, -1).trim());
    }
    
    // Look for input mentions
    const inputMatch = description.match(/(?:input|parameter|data|information)\s+([^.]+)/i);
    return inputMatch ? [inputMatch[1].trim()] : ['data'];
  }

  private suggestImplementation(description: string): string {
    const desc = description.toLowerCase();
    
    if (desc.includes('financial') || desc.includes('analysis')) {
      return 'use_python_function';
    } else if (desc.includes('api') || desc.includes('fetch')) {
      return 'make_api_call';
    } else if (desc.includes('calculate') || desc.includes('compute')) {
      return 'execute_calculation';
    } else {
      return 'process_data';
    }
  }

  private extractContext(text: string, entityName: string, contextSize: number = 200): string {
    const nameIndex = text.indexOf(entityName.toLowerCase());
    if (nameIndex === -1) return '';
    
    const start = Math.max(0, nameIndex - contextSize);
    const end = Math.min(text.length, nameIndex + entityName.length + contextSize);
    
    return text.substring(start, end);
  }

  private extractAgentsFromContext(text: string, parsed: ParsedWorkflow, warnings: string[]) {
    // Default agents for financial workflow if not specified
    parsed.agents.push(
      {
        name: 'Financial Analyst',
        role: 'Senior Financial Analyst',
        description: 'Analyzes financial documents and generates comprehensive reports',
        tools: ['document_analyzer', 'financial_calculator', 'chart_generator'],
        model: 'gemini-2.5-flash',
        expertise: ['financial analysis', 'document processing', 'report generation']
      },
      {
        name: 'Quality Reviewer', 
        role: 'Financial Quality Assurance Specialist',
        description: 'Reviews and validates financial reports for accuracy and consistency',
        tools: ['verification_service', 'error_detector', 'compliance_checker'],
        model: 'gemini-2.0-flash-thinking-exp',
        expertise: ['quality assurance', 'mathematical verification', 'compliance checking']
      },
      {
        name: 'Content Creator',
        role: 'Financial Communication Specialist',
        description: 'Creates summaries and generates audio content for financial reports',
        tools: ['text_summarizer', 'audio_generator', 'markdown_formatter'],
        model: 'nvidia/nemotron-nano-12b-v2-vl',
        expertise: ['content creation', 'audio generation', 'communication']
      }
    );
    warnings.push('No specific agents found in description, using default financial workflow agents');
  }

  private generateSuggestions(parsed: ParsedWorkflow, suggestions: string[]) {
    if (parsed.agents.length === 0) {
      suggestions.push('Consider defining specific AI agents for different roles in your workflow');
    }
    
    if (parsed.tasks.length === 0) {
      suggestions.push('Define specific tasks that each agent should perform');
    }
    
    if (parsed.tools.length === 0) {
      suggestions.push('Specify tools or functions that agents should have access to');
    }
    
    if (Object.keys(parsed.models).length === 0) {
      suggestions.push('Configure which AI models to use for each agent or task');
    }

    // Model-specific suggestions
    if (parsed.agents.some(a => a.model.includes('financial'))) {
      suggestions.push('Consider using NVIDIA Nemotron for financial document analysis');
    }
    
    if (parsed.tools.some(t => t.type === 'visualization')) {
      suggestions.push('Add chart generation capabilities for financial data visualization');
    }
  }

  private findMissingComponents(parsed: ParsedWorkflow): string[] {
    const missing: string[] = [];
    
    if (parsed.agents.length === 0) missing.push('AI Agents');
    if (parsed.tasks.length === 0) missing.push('Workflow Tasks');
    if (Object.keys(parsed.models).length === 0) missing.push('Model Configurations');
    
    // Check for specific financial workflow components
    if (!parsed.tasks.some(t => t.name.toLowerCase().includes('analysis'))) {
      missing.push('Financial Analysis Task');
    }
    
    if (!parsed.tasks.some(t => t.name.toLowerCase().includes('verification') || t.name.toLowerCase().includes('review'))) {
      missing.push('Quality Verification Task');
    }
    
    return missing;
  }

  // Convert parsed configuration to actual workflow
  buildWorkflowDefinition(parsed: ParsedWorkflow, config: ApiConfig): WorkflowDefinition {
    const workflow: WorkflowDefinition = {
      name: 'AI-Powered Financial Analysis Workflow',
      description: 'Automated financial document analysis and report generation',
      agents: parsed.agents.map(agent => this.convertToAgentRole(agent, config)),
      tasks: this.convertToTasks(parsed.tasks, parsed.agents),
      tools: this.convertToTools(parsed.tools),
      models: this.extractModelConfigs(parsed, config),
      dependencies: this.calculateDependencies(parsed.tasks)
    };

    return workflow;
  }

  private convertToAgentRole(parsedAgent: ParsedAgent, apiConfig: ApiConfig): AgentRole {
    return {
      name: parsedAgent.name,
      description: parsedAgent.description,
      goal: `Perform ${parsedAgent.role.toLowerCase()} tasks efficiently and accurately`,
      backstory: `You are a ${parsedAgent.role} with expertise in ${parsedAgent.expertise.join(', ')}. You have deep knowledge of financial analysis and are committed to delivering high-quality results.`,
      tools: this.createAgentTools(parsedAgent.tools, parsedAgent.name),
      llm: this.selectModel(parsedAgent.model, apiConfig)
    };
  }

  private convertToTasks(parsedTasks: ParsedTask[], agents: ParsedAgent[]): Task[] {
    return parsedTasks.map(task => ({
      description: task.description,
      agent: task.agent,
      expected_output: task.output,
      context: `This task is part of a financial analysis workflow. Prerequisites: ${task.prerequisites.join(', ')}`
    }));
  }

  private convertToTools(parsedTools: ParsedTool[]): ToolDefinition[] {
    return parsedTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: this.createToolParameters(tool.parameters),
      function: tool.implementation
    }));
  }

  private createAgentTools(toolNames: string[], agentName: string): ToolDefinition[] {
    const tools: ToolDefinition[] = [];

    // Default tools for financial workflow
    if (agentName.toLowerCase().includes('analyst')) {
      tools.push(
        {
          name: 'financial_document_analyzer',
          description: 'Analyzes financial documents and extracts key information',
          parameters: [
            { name: 'document', type: 'file', description: 'Financial document to analyze', required: true },
            { name: 'analysis_type', type: 'string', description: 'Type of analysis to perform', required: false }
          ],
          function: 'analyze_financial_document'
        },
        {
          name: 'financial_calculator',
          description: 'Performs financial calculations and ratio analysis',
          parameters: [
            { name: 'data', type: 'array', description: 'Financial data to calculate', required: true },
            { name: 'calculation_type', type: 'string', description: 'Type of calculation', required: true }
          ],
          function: 'calculate_financial_metrics'
        }
      );
    }

    if (agentName.toLowerCase().includes('reviewer')) {
      tools.push(
        {
          name: 'verification_service',
          description: 'Verifies mathematical accuracy and consistency',
          parameters: [
            { name: 'report_data', type: 'object', description: 'Report data to verify', required: true }
          ],
          function: 'verify_financial_data'
        }
      );
    }

    return tools;
  }

  private createToolParameters(paramNames: string[]): ToolParameter[] {
    return paramNames.map(param => ({
      name: param,
      type: this.inferParameterType(param),
      description: `Parameter: ${param}`,
      required: true
    }));
  }

  private inferParameterType(paramName: string): ToolParameter['type'] {
    const name = paramName.toLowerCase();
    
    if (name.includes('file') || name.includes('document')) return 'file';
    if (name.includes('count') || name.includes('number') || name.includes('amount')) return 'number';
    if (name.includes('enabled') || name.includes('active') || name.includes('flag')) return 'boolean';
    if (name.includes('list') || name.includes('array') || name.includes('data')) return 'array';
    
    return 'string';
  }

  private selectModel(modelName: string, apiConfig: ApiConfig): ModelConfig {
    // Map natural language model names to actual models
    const modelMap: Record<string, string> = {
      'gpt-4': 'openai/gpt-4o',
      'claude': 'anthropic/claude-3.5-sonnet',
      'gemini': 'gemini-2.5-flash',
      'nemotron': 'nvidia/nemotron-nano-12b-v2-vl',
      'fast': 'gemini-2.5-flash',
      'reasoning': 'gemini-2.0-flash-thinking-exp',
      'financial': 'nvidia/nemotron-nano-12b-v2-vl'
    };

    const mappedModel = modelMap[modelName.toLowerCase()] || modelName;
    
    return {
      provider: mappedModel.includes('/') ? 'openrouter' : 'gemini',
      model: mappedModel,
      temperature: 0.1, // Low temperature for financial analysis
      max_tokens: 4000
    };
  }

  private extractModelConfigs(parsed: ParsedWorkflow, apiConfig: ApiConfig): Record<string, ModelConfig> {
    const configs: Record<string, ModelConfig> = {};
    
    Object.entries(parsed.models).forEach(([component, model]) => {
      configs[component] = this.selectModel(model, apiConfig);
    });

    // Add default configurations
    if (!configs['primary']) {
      configs['primary'] = this.selectModel(parsed.agents[0]?.model || 'gemini-2.5-flash', apiConfig);
    }

    return configs;
  }

  private calculateDependencies(tasks: ParsedTask[]): string[] {
    // Simple dependency calculation based on prerequisites
    const dependencies: string[] = [];
    
    tasks.forEach(task => {
      task.prerequisites.forEach(prereq => {
        dependencies.push(`${prereq} -> ${task.name}`);
      });
    });

    return dependencies;
  }

  // Execute workflow using CrewAI concepts
  async executeWorkflow(workflow: WorkflowDefinition, files: { [key: string]: File }): Promise<CrewExecution> {
    const executionId = `exec_${Date.now()}`;
    const execution: CrewExecution = {
      workflowId: executionId,
      status: 'pending',
      agents: new Map(),
      tasks: workflow.tasks,
      results: new Map(),
      logs: [],
      metrics: {
        startTime: new Date(),
        totalTasks: workflow.tasks.length,
        completedTasks: 0,
        failedTasks: 0,
        totalCost: 0,
        tokensUsed: 0
      }
    };

    this.executionStore.set(executionId, execution);
    execution.status = 'running';

    try {
      // Initialize agents
      for (const agentConfig of workflow.agents) {
        const agent = await this.createAgent(agentConfig, executionId);
        execution.agents.set(agentConfig.name, agent);
        this.log(executionId, 'info', 'coordinator', 'initialization', `Initialized agent: ${agentConfig.name}`);
      }

      // Execute tasks in dependency order
      const completedTasks = new Set<string>();
      const tasks = this.sortTasksByDependencies(workflow.tasks, workflow.dependencies);

      for (const task of tasks) {
        try {
          const result = await this.executeTask(task, execution, files);
          execution.results.set(task.description, result);
          completedTasks.add(task.description);
          execution.metrics.completedTasks++;
          this.log(executionId, 'success', task.agent, task.description, 'Task completed successfully', result);
        } catch (error) {
          execution.metrics.failedTasks++;
          this.log(executionId, 'error', task.agent, task.description, `Task failed: ${error.message}`);
        }
      }

      execution.status = 'completed';
      execution.metrics.endTime = new Date();
      execution.metrics.duration = execution.metrics.endTime.getTime() - execution.metrics.startTime.getTime();

    } catch (error) {
      execution.status = 'failed';
      execution.metrics.endTime = new Date();
      execution.metrics.duration = execution.metrics.endTime.getTime() - execution.metrics.startTime.getTime();
      this.log(executionId, 'error', 'coordinator', 'workflow', `Workflow execution failed: ${error.message}`);
    }

    return execution;
  }

  private async createAgent(agentConfig: AgentRole, executionId: string): Promise<any> {
    // This would integrate with actual CrewAI library
    // For now, we'll create a mock agent that simulates CrewAI behavior
    
    const agent = {
      name: agentConfig.name,
      role: agentConfig.description,
      goal: agentConfig.goal,
      backstory: agentConfig.backstory,
      tools: agentConfig.tools,
      llm: agentConfig.llm,
      memory: new Map(),
      verbose: true,
      
      async executeTask(task: Task, context: any): Promise<any> {
        const startTime = Date.now();
        
        try {
          this.log(`Starting task: ${task.description}`);
          
          // Simulate task execution based on agent role
          let result;
          if (this.name.toLowerCase().includes('analyst')) {
            result = await this.executeAnalysisTask(task, context);
          } else if (this.name.toLowerCase().includes('reviewer')) {
            result = await this.executeReviewTask(task, context);
          } else if (this.name.toLowerCase().includes('creator')) {
            result = await this.executeCreationTask(task, context);
          } else {
            result = await this.executeGenericTask(task, context);
          }

          const duration = Date.now() - startTime;
          this.log(`Task completed in ${duration}ms`);
          
          return result;
        } catch (error) {
          this.log(`Task failed: ${error.message}`, 'error');
          throw error;
        }
      },

      log: (message: string, level: string = 'info') => {
        console.log(`[${level.toUpperCase()}] ${this.name}: ${message}`);
      }
    };

    return agent;
  }

  private async executeAnalysisTask(task: Task, context: any): Promise<any> {
    // Simulate financial analysis
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing time
    
    return {
      type: 'analysis',
      result: 'Financial analysis completed',
      confidence: 0.95,
      data: {
        metrics: ['revenue', 'expenses', 'profit'],
        trends: ['positive', 'stable'],
        recommendations: ['optimize costs', 'increase revenue']
      }
    };
  }

  private async executeReviewTask(task: Task, context: any): Promise<any> {
    // Simulate review process
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
      type: 'review',
      result: 'Quality review completed',
      status: 'approved',
      issues: [],
      verification: {
        mathematical_accuracy: 1.0,
        consistency_score: 0.98,
        compliance_status: 'passed'
      }
    };
  }

  private async executeCreationTask(task: Task, context: any): Promise<any> {
    // Simulate content creation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      type: 'creation',
      result: 'Content created successfully',
      output_format: 'markdown',
      quality_score: 0.92,
      content: {
        summary: 'Financial report summary',
        highlights: ['key metrics', 'trends'],
        audio_duration: '5:30'
      }
    };
  }

  private async executeGenericTask(task: Task, context: any): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return { type: 'generic', result: 'Task completed', status: 'success' };
  }

  private async executeTask(task: Task, execution: CrewExecution, files: { [key: string]: File }): Promise<any> {
    const agent = execution.agents.get(task.agent);
    if (!agent) {
      throw new Error(`Agent ${task.agent} not found`);
    }

    const context = {
      files,
      previous_results: Array.from(execution.results.values()),
      current_task: task
    };

    return await agent.executeTask(task, context);
  }

  private sortTasksByDependencies(tasks: Task[], dependencies: string[]): Task[] {
    // Simple topological sort for task execution order
    const taskMap = new Map(tasks.map(t => [t.description, t]));
    const sorted: Task[] = [];
    const visited = new Set<string>();
    const temp = new Set<string>();

    const visit = (task: Task) => {
      if (temp.has(task.description)) {
        throw new Error('Cyclic dependency detected');
      }
      if (!visited.has(task.description)) {
        temp.add(task.description);
        
        // Check dependencies
        const deps = dependencies.filter(d => d.endsWith(`-> ${task.description}`));
        deps.forEach(dep => {
          const prereq = dep.split(' -> ')[0];
          const prereqTask = taskMap.get(prereq);
          if (prereqTask) {
            visit(prereqTask);
          }
        });

        temp.delete(task.description);
        visited.add(task.description);
        sorted.push(task);
      }
    };

    tasks.forEach(task => visit(task));
    return sorted;
  }

  private log(executionId: string, level: ExecutionLog['level'], agent: string, task: string, message: string, data?: any) {
    const execution = this.executionStore.get(executionId);
    if (!execution) return;

    const log: ExecutionLog = {
      timestamp: new Date().toISOString(),
      agent,
      task,
      message,
      level,
      data
    };

    execution.logs.push(log);
    
    // Also log to console for development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${level.toUpperCase()}] ${agent} - ${task}: ${message}`);
    }
  }

  // Public methods for getting execution status
  getExecution(executionId: string): CrewExecution | undefined {
    return this.executionStore.get(executionId);
  }

  getAllExecutions(): CrewExecution[] {
    return Array.from(this.executionStore.values());
  }

  // Create automatic tools based on parsed configuration
  generateTools(tools: ParsedTool[]): ToolDefinition[] {
    return tools.map(tool => ({
      name: `auto_${tool.name}`,
      description: `Automatically generated tool: ${tool.description}`,
      parameters: tool.parameters.map(p => ({
        name: p,
        type: this.inferParameterType(p),
        description: `Generated parameter: ${p}`,
        required: true
      })),
      function: `auto_${tool.implementation}`,
      model: {
        provider: 'openrouter',
        model: 'nvidia/nemotron-nano-12b-v2-vl'
      }
    }));
  }
}

export const crewaiService = new CrewAIService();