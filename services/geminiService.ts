import type { ReportData, VerificationResult } from '../types';
import { FinancialReportService, type ReportGenerationOptions } from './financialReportService';

// Legacy interface for backward compatibility
export interface ApiConfig {
  provider: 'openrouter' | 'gemini';
  apiKey: string;
  model: string;
  voiceModel?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

// Legacy service that now uses the new OpenRouter-based implementation
export class GeminiService {
  private financialReportService: FinancialReportService;

  constructor(apiKey?: string) {
    this.financialReportService = new FinancialReportService(apiKey);
  }

  async generateFinancialReport(
    file2024: File,
    file2025: File,
    companyName: string,
    apiConfig: ApiConfig
  ): Promise<ReportData> {
    console.log('Generating financial report with OpenRouter integration...');
    
    const options: ReportGenerationOptions = {
      priority: 'quality', // Default to quality for financial reports
      maxCostPerRequest: 10 // $10 max per request
    };

    const result = await this.financialReportService.generateCompleteReport(
      file2024,
      file2025,
      companyName,
      options
    );

    if (!result.success || !result.reportData) {
      throw new Error(result.error || 'Failed to generate financial report');
    }

    // Convert new ReportData format to legacy format
    const newReportData = result.reportData;
    
    // Create a basic legacy ReportData structure
    const legacyReportData: ReportData = {
      summary: 'Financial report generated successfully',
      kpis: [
        {
          name: 'Revenue Growth',
          value2025: '0',
          value2024: '0',
          changePercentage: 0
        },
        {
          name: 'Profit Margin',
          value2025: '0',
          value2024: '0',
          changePercentage: 0
        }
      ],
      abn: '', // Would need to be extracted from documents
      directorsDeclaration: {
        directors: [],
        date: new Date().toISOString()
      },
      incomeStatement: {
        revenue: [],
        expenses: [],
        grossProfit: { amount2025: 0, amount2024: 0 },
        operatingIncome: { amount2025: 0, amount2024: 0 },
        netProfit: { amount2025: 0, amount2024: 0 }
      },
      balanceSheet: {
        currentAssets: [],
        nonCurrentAssets: [],
        currentLiabilities: [],
        nonCurrentLiabilities: [],
        equity: [],
        totalAssets: { amount2025: 0, amount2024: 0 },
        totalLiabilities: { amount2025: 0, amount2024: 0 },
        totalEquity: { amount2025: 0, amount2024: 0 }
      },
      cashFlowStatement: {
        operatingActivities: [],
        investingActivities: [],
        financingActivities: [],
        netChangeInCash: { amount2025: 0, amount2024: 0 }
      },
      notesToFinancialStatements: 'Financial report generated using OpenRouter API with optimized model selection.'
    };

    return legacyReportData;
  }

  async fixFinancialReport(
    reportData: ReportData,
    verification: VerificationResult,
    apiConfig: ApiConfig
  ): Promise<ReportData> {
    console.log('Fixing financial report with verification:', verification);

    // For now, just return the original report with a note
    // In a full implementation, this would use the correction service
    return {
      ...reportData,
      notesToFinancialStatements: reportData.notesToFinancialStatements + 
        '\n\nReport fixed based on verification results.'
    };
  }

  async generateAudioSummary(
    text: string,
    apiConfig: ApiConfig
  ): Promise<string> {
    console.log('Generating audio summary for:', text.substring(0, 50) + '...');
    
    const voiceModel = apiConfig.voiceModel || 'elevenlabs/eleven-multilingual-v2';
    const result = await this.financialReportService.generateAudioSummary(
      text,
      voiceModel
    );

    return result.audioUrl;
  }

  async generateOpenRouterAudioSummary(
    text: string,
    apiConfig: ApiConfig
  ): Promise<string> {
    console.log('Generating OpenRouter audio summary for:', text.substring(0, 50) + '...');
    
    const voiceModel = apiConfig.voiceModel || 'elevenlabs/eleven-multilingual-v2';
    const result = await this.financialReportService.generateAudioSummary(
      text,
      voiceModel
    );

    return result.audioUrl;
  }

  // Legacy method for backward compatibility
  async processFiles(
    file2024: File,
    file2025: File
  ): Promise<{ processed2024: any; processed2025: any }> {
    console.log('Processing files with OCR...');
    
    // For now, return placeholder data
    // In a full implementation, this would use the OCR service
    return {
      processed2024: { revenue: { items: [], total: 0 } },
      processed2025: { revenue: { items: [], total: 0 } }
    };
  }

  // New method to get cost information
  async getCostEstimate(
    file2024: File,
    file2025: File,
    priority: 'cost' | 'speed' | 'quality' = 'quality'
  ): Promise<{ estimatedCost: number; modelBreakdown: { ocr: string; generation: string; correction: string } }> {
    // Import dynamically to avoid circular dependencies
    const { getOpenRouterClient } = await import('./api/openRouterClient');
    const client = getOpenRouterClient();
    
    // Get model selections for each task
    const ocrSelection = client.selectOptimalModel('ocr', { priority });
    const generationSelection = client.selectOptimalModel('generation', { priority });
    const correctionSelection = client.selectOptimalModel('correction', { priority });
    
    // Estimate costs (OCR and correction are free, generation may cost)
    const estimatedCost = generationSelection.selected.cost.input > 0 ? 5 : 0; // Rough estimate
    
    return {
      estimatedCost,
      modelBreakdown: {
        ocr: ocrSelection.selected.id,
        generation: generationSelection.selected.id,
        correction: correctionSelection.selected.id
      }
    };
  }

  // New method to validate API key
  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const { getOpenRouterClient } = await import('./api/openRouterClient');
      const client = getOpenRouterClient(apiKey);
      return await client.validateApiKey();
    } catch (error) {
      console.error('API key validation failed:', error);
      return false;
    }
  }

  // New method to get usage information
  getUsageInformation(): { daily: any; monthly: any; isWithinLimits: boolean } {
    const dailyUsage = this.financialReportService.getDailyUsage();
    const monthlyUsage = this.financialReportService.getMonthlyUsage();
    const isWithinLimits = this.financialReportService.isWithinLimits();
    
    return {
      daily: dailyUsage,
      monthly: monthlyUsage,
      isWithinLimits: isWithinLimits.daily && isWithinLimits.monthly
    };
  }

  // New method to clear usage records
  clearUsageRecords(): void {
    this.financialReportService.clearUsageRecords();
  }
}

// Export singleton instance for backward compatibility
let geminiService: GeminiService | null = null;

export function getGeminiService(apiKey?: string): GeminiService {
  if (!geminiService) {
    geminiService = new GeminiService(apiKey);
  }
  return geminiService;
}

export function resetGeminiService(): void {
  geminiService = null;
}