import type { TaskType, PriorityType, BudgetConstraints } from './types/openRouter';
import { getOpenRouterClient } from './api/openRouterClient';
import { NemotronOcrService, type FinancialDataExtraction, type ProcessedDocument } from './ocr/nemotronOcrService';
import { GrokAnalysisService, type ReportData, type ComparisonAnalysis } from './analysis/grokAnalysisService';
import { GeminiCorrectionService, type VerificationResult, type CorrectedReportData } from './correction/geminiCorrectionService';

export interface ReportGenerationOptions {
  priority?: PriorityType;
  maxCostPerRequest?: number;
  useCrewAI?: boolean;
  workflow?: any;
}

export interface ReportGenerationResult {
  success: boolean;
  reportData?: CorrectedReportData;
  verification?: VerificationResult;
  processingTime: number;
  totalCost: number;
  modelUsage: {
    ocr: string;
    generation: string;
    correction: string;
  };
  costBreakdown: {
    ocr: number;
    generation: number;
    correction: number;
  };
  error?: string;
}

export interface UsageRecord {
  timestamp: Date;
  model: string;
  taskType: TaskType;
  tokens: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  cost: number;
  duration: number;
}

export interface DailyUsage {
  date: string;
  totalCost: number;
  totalTokens: number;
  requestCount: number;
  modelBreakdown: Record<string, { cost: number; tokens: number; requests: number }>;
}

export interface MonthlyUsage {
  month: string;
  totalCost: number;
  totalTokens: number;
  requestCount: number;
  modelBreakdown: Record<string, { cost: number; tokens: number; requests: number }>;
}

export class FinancialReportService {
  private ocrService: NemotronOcrService;
  private analysisService: GrokAnalysisService;
  private correctionService: GeminiCorrectionService;
  private usageRecords: UsageRecord[] = [];

  constructor(apiKey?: string) {
    // Initialize OpenRouter client
    getOpenRouterClient(apiKey);
    
    this.ocrService = new NemotronOcrService();
    this.analysisService = new GrokAnalysisService();
    this.correctionService = new GeminiCorrectionService();
    
    // Load usage records from localStorage
    this.loadUsageRecords();
  }

  async generateCompleteReport(
    file2024: File,
    file2025: File,
    companyName: string,
    options: ReportGenerationOptions = {}
  ): Promise<ReportGenerationResult> {
    const startTime = Date.now();
    let totalCost = 0;
    const modelUsage = {
      ocr: 'nvidia/nemotron-nano-12b-v2-vl',
      generation: 'x-ai/grok-4-fast',
      correction: 'google/gemini-2.0-flash-exp'
    };

    try {
      // Step 1: OCR Processing (FREE - Nemotron Nano)
      console.log('Step 1: Processing documents with Nemotron Nano OCR...');
      const [processed2024, processed2025] = await Promise.all([
        this.processFile(file2024),
        this.processFile(file2025)
      ]);

      // Step 2: Report Generation (Paid - Grok 4 Fast or Free - Gemini Flash)
      console.log('Step 2: Generating financial report...');
      const modelSelection = this.selectOptimalModel('generation', options);
      
      let reportData: ReportData;
      if (modelSelection.selected.id === 'x-ai/grok-4-fast') {
        reportData = await this.analysisService.generateFinancialReport(
          processed2024.financialData,
          processed2025.financialData,
          companyName,
          options.priority || 'quality'
        );
      } else {
        // Use Gemini Flash as free alternative
        reportData = await this.analysisService.generateFinancialReport(
          processed2024.financialData,
          processed2025.financialData,
          companyName,
          'cost' // Force cost priority
        );
      }

      totalCost += reportData.cost || 0;
      modelUsage.generation = reportData.modelUsed;

      // Step 3: Verification and Correction (FREE - Gemini Flash)
      console.log('Step 3: Verifying and correcting report...');
      const verification = await this.correctionService.validateCalculations(reportData);
      
      let finalReport: CorrectedReportData;
      if (verification.overallStatus !== 'Passed') {
        finalReport = await this.correctionService.fixFinancialReport(
          reportData,
          verification
        );
      } else {
        finalReport = {
          ...reportData,
          correctionAttempts: 0,
          finalVerificationStatus: 'Passed',
          modelUsed: 'google/gemini-2.0-flash-exp',
          cost: 0
        };
      }

      const duration = Date.now() - startTime;

      // Record usage
      this.recordUsage({
        timestamp: new Date(),
        model: modelUsage.generation,
        taskType: 'generation',
        tokens: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }, // Would be populated from actual API response
        cost: totalCost,
        duration
      });

      return {
        success: true,
        reportData: finalReport,
        verification,
        processingTime: duration,
        totalCost,
        modelUsage,
        costBreakdown: {
          ocr: 0, // Free
          generation: reportData.cost || 0,
          correction: 0 // Free
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        processingTime: Date.now() - startTime,
        totalCost,
        modelUsage,
        costBreakdown: {
          ocr: 0,
          generation: 0,
          correction: 0
        }
      };
    }
  }

  async compareFinancialPeriods(
    data2024: FinancialDataExtraction,
    data2025: FinancialDataExtraction,
    options: ReportGenerationOptions = {}
  ): Promise<ComparisonAnalysis> {
    const modelSelection = this.selectOptimalModel('analysis', options);
    
    if (modelSelection.selected.id === 'x-ai/grok-4-fast') {
      return await this.analysisService.compareFinancialPeriods(data2024, data2025);
    } else {
      // Use Gemini Flash as free alternative
      return await this.analysisService.compareFinancialPeriods(data2024, data2025);
    }
  }

  async generateAudioSummary(
    text: string,
    voiceModel: string = 'elevenlabs/eleven-multilingual-v2'
  ): Promise<{ audioUrl: string; cost: number }> {
    const apiClient = getOpenRouterClient();
    
    const response = await apiClient.chatCompletion({
      model: voiceModel,
      messages: [
        {
          role: 'system',
          content: 'Generate audio summary of the provided financial text.'
        },
        {
          role: 'user',
          content: `Create audio summary: ${text.substring(0, 500)}...`
        }
      ],
      max_tokens: 1000
    });

    if (!response.success) {
      throw new Error(response.error?.error.message || 'Failed to generate audio summary');
    }

    const messageContent = response.data?.choices[0]?.message?.content;
    const audioUrl = typeof messageContent === 'string' ? messageContent : 
      messageContent?.find((content: any) => content.type === 'text')?.text || '';

    return {
      audioUrl,
      cost: response.metadata?.cost || 0
    };
  }

  private async processFile(file: File): Promise<ProcessedDocument> {
    if (file.type.startsWith('image/')) {
      return await this.ocrService.processImageFile(file);
    } else if (file.type === 'application/pdf') {
      return await this.ocrService.processPdfDocument(file);
    } else if (file.type.includes('spreadsheet') || file.type.includes('excel')) {
      // For Excel files, we'd need a spreadsheet processing library
      // For now, treat as image processing
      return await this.ocrService.processImageFile(file);
    } else {
      throw new Error(`Unsupported file type: ${file.type}`);
    }
  }

  private selectOptimalModel(taskType: TaskType, options: ReportGenerationOptions) {
    const apiClient = getOpenRouterClient();
    
    return apiClient.selectOptimalModel(taskType, {
      priority: options.priority || 'cost',
      maxTokens: options.maxCostPerRequest ? 1000 : undefined
    }, {
      maxCostPerRequest: options.maxCostPerRequest
    });
  }

  private recordUsage(record: UsageRecord): void {
    this.usageRecords.push(record);
    
    // Keep only last 1000 records
    if (this.usageRecords.length > 1000) {
      this.usageRecords = this.usageRecords.slice(-1000);
    }
    
    // Save to localStorage
    this.saveUsageRecords();
  }

  private loadUsageRecords(): void {
    try {
      const saved = localStorage.getItem('apiUsageRecords');
      if (saved) {
        this.usageRecords = JSON.parse(saved).map((record: any) => ({
          ...record,
          timestamp: new Date(record.timestamp)
        }));
      }
    } catch (error) {
      console.warn('Failed to load usage records:', error);
    }
  }

  private saveUsageRecords(): void {
    try {
      localStorage.setItem('apiUsageRecords', JSON.stringify(this.usageRecords));
    } catch (error) {
      console.warn('Failed to save usage records:', error);
    }
  }

  getDailyUsage(): DailyUsage {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const todayRecords = this.usageRecords.filter(record => 
      record.timestamp.toISOString().split('T')[0] === todayStr
    );

    const modelBreakdown: Record<string, { cost: number; tokens: number; requests: number }> = {};
    
    todayRecords.forEach(record => {
      if (!modelBreakdown[record.model]) {
        modelBreakdown[record.model] = { cost: 0, tokens: 0, requests: 0 };
      }
      modelBreakdown[record.model].cost += record.cost;
      modelBreakdown[record.model].tokens += record.tokens.total_tokens;
      modelBreakdown[record.model].requests += 1;
    });

    return {
      date: todayStr,
      totalCost: todayRecords.reduce((sum, record) => sum + record.cost, 0),
      totalTokens: todayRecords.reduce((sum, record) => sum + record.tokens.total_tokens, 0),
      requestCount: todayRecords.length,
      modelBreakdown
    };
  }

  getMonthlyUsage(): MonthlyUsage {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStr = monthStart.toISOString().slice(0, 7);
    
    const monthRecords = this.usageRecords.filter(record => 
      record.timestamp >= monthStart
    );

    const modelBreakdown: Record<string, { cost: number; tokens: number; requests: number }> = {};
    
    monthRecords.forEach(record => {
      if (!modelBreakdown[record.model]) {
        modelBreakdown[record.model] = { cost: 0, tokens: 0, requests: 0 };
      }
      modelBreakdown[record.model].cost += record.cost;
      modelBreakdown[record.model].tokens += record.tokens.total_tokens;
      modelBreakdown[record.model].requests += 1;
    });

    return {
      month: monthStr,
      totalCost: monthRecords.reduce((sum, record) => sum + record.cost, 0),
      totalTokens: monthRecords.reduce((sum, record) => sum + record.tokens.total_tokens, 0),
      requestCount: monthRecords.length,
      modelBreakdown
    };
  }

  isWithinLimits(dailyLimit: number = 10, monthlyLimit: number = 100): { daily: boolean; monthly: boolean } {
    const dailyUsage = this.getDailyUsage();
    const monthlyUsage = this.getMonthlyUsage();
    
    return {
      daily: dailyUsage.totalCost < dailyLimit,
      monthly: monthlyUsage.totalCost < monthlyLimit
    };
  }

  clearUsageRecords(): void {
    this.usageRecords = [];
    this.saveUsageRecords();
  }
}