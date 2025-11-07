import type { 
  OpenRouterRequest, 
  OpenRouterMessage,
  ApiResponse,
  TaskType,
  PriorityType
} from '../types/openRouter';
import { getOpenRouterClient } from '../api/openRouterClient';
import type { FinancialDataExtraction } from '../ocr/nemotronOcrService';

export interface ReportData {
  companyName: string;
  reportYear: string;
  dateGenerated: string;
  modelUsed: string;
  reasoningEnabled?: boolean;
  cost?: number;
  incomeStatement: {
    revenue: Array<{ item: string; amount2025: number; amount2024: number; change: number; changePercent: number }>;
    expenses: Array<{ item: string; amount2025: number; amount2024: number; change: number; changePercent: number }>;
    netProfit: { amount2025: number; amount2024: number; change: number; changePercent: number };
  };
  balanceSheet: {
    assets: Array<{ item: string; amount2025: number; amount2024: number; change: number; changePercent: number }>;
    liabilities: Array<{ item: string; amount2025: number; amount2024: number; change: number; changePercent: number }>;
    equity: Array<{ item: string; amount2025: number; amount2024: number; change: number; changePercent: number }>;
    totalAssets: { amount2025: number; amount2024: number; change: number; changePercent: number };
    totalLiabilities: { amount2025: number; amount2024: number; change: number; changePercent: number };
    totalEquity: { amount2025: number; amount2024: number; change: number; changePercent: number };
  };
  cashFlowStatement: {
    operatingActivities: Array<{ item: string; amount2025: number; amount2024: number; change: number; changePercent: number }>;
    investingActivities: Array<{ item: string; amount2025: number; amount2024: number; change: number; changePercent: number }>;
    financingActivities: Array<{ item: string; amount2025: number; amount2024: number; change: number; changePercent: number }>;
    netCashFlow: { amount2025: number; amount2024: number; change: number; changePercent: number };
  };
  keyPerformanceIndicators: {
    revenueGrowth: { percent: number; amount: number };
    profitMargin: { percent: number; amount: number };
    returnOnAssets: { percent: number; amount: number };
    debtToEquity: { ratio: number; amount: number };
    currentRatio: { ratio: number; amount: number };
  };
  notes: Array<{
    noteNumber: number;
    title: string;
    content: string;
  }>;
}

export interface ComparisonAnalysis {
  revenueAnalysis: {
    growthRate: number;
    growthDrivers: string[];
    risks: string[];
  };
  expenseAnalysis: {
    optimizationOpportunities: string[];
    costReductionPotential: string[];
    fixedVsVariable: string[];
  };
  profitabilityAnalysis: {
    profitTrends: string[];
    marginImprovements: string[];
    breakEvenAnalysis: string[];
  };
  riskFactors: {
    identified: string[];
    mitigations: string[];
    probability: string[];
  };
  recommendations: {
    shortTerm: string[];
    longTerm: string[];
    strategic: string[];
  };
}

export class GrokAnalysisService {
  private apiClient = getOpenRouterClient();

  async generateFinancialReport(
    data2024: FinancialDataExtraction,
    data2025: FinancialDataExtraction,
    companyName: string,
    priority: PriorityType = 'quality'
  ): Promise<ReportData> {
    const response = await this.apiClient.chatCompletion({
      model: 'x-ai/grok-4-fast',
      messages: [
        {
          role: 'system',
          content: `You are an expert financial accountant specializing in Australian reporting standards.
          As xAI Grok 4 Fast model with finance category specialization, generate comprehensive financial reports.
          Ensure mathematical accuracy, regulatory compliance, and professional presentation.
          
          Categories to focus on: #1 Finance, #2 Technology
          Use reasoning mode for complex calculations and cross-year comparisons.`
        },
        {
          role: 'user',
          content: `Generate complete 2025 financial report for ${companyName} using this data:

2024 Financial Data:
${JSON.stringify(data2024, null, 2)}

2025 Financial Data:
${JSON.stringify(data2025, null, 2)}

Requirements:
1. Income Statement with year-over-year comparisons
2. Balance Sheet with proper asset/liability equity
3. Cash Flow Statement
4. Key Performance Indicators with growth rates
5. Notes to Financial Statements

Ensure all numbers are consistent and mathematically correct.`
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 8000,
      temperature: 0.2,
      // Enable reasoning for complex financial analysis
      reasoning: { enabled: true }
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.error.message || 'Failed to generate financial report');
    }

    const reportData = JSON.parse(response.data.choices[0].message.content as string);
    
    // Add metadata
    return {
      ...reportData,
      companyName,
      reportYear: '2025',
      dateGenerated: new Date().toISOString(),
      modelUsed: 'x-ai/grok-4-fast',
      reasoningEnabled: response.metadata.reasoning,
      cost: response.metadata.cost
    };
  }

  async compareFinancialPeriods(
    data2024: FinancialDataExtraction,
    data2025: FinancialDataExtraction
  ): Promise<ComparisonAnalysis> {
    const response = await this.apiClient.chatCompletion({
      model: 'x-ai/grok-4-fast',
      messages: [
        {
          role: 'system',
          content: `As Grok 4 Fast with finance specialization, analyze year-over-year financial changes.
          Identify trends, anomalies, and key performance drivers. Use reasoning for deep insights.`
        },
        {
          role: 'user',
          content: `Compare these two financial periods and provide detailed analysis:

2024 Data:
${JSON.stringify(data2024, null, 2)}

2025 Data:
${JSON.stringify(data2025, null, 2)}

Focus on:
1. Revenue growth drivers
2. Expense optimization opportunities
3. Profitability trends
4. Risk factors and mitigations
5. Strategic recommendations

Provide actionable insights for business improvement.`
        }
      ],
      reasoning: { enabled: true },
      max_tokens: 6000,
      temperature: 0.3
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.error.message || 'Failed to analyze financial periods');
    }

    return JSON.parse(response.data.choices[0].message.content as string);
  }

  async generateKeyPerformanceIndicators(
    data2024: FinancialDataExtraction,
    data2025: FinancialDataExtraction
  ): Promise<any> {
    const response = await this.apiClient.chatCompletion({
      model: 'x-ai/grok-4-fast',
      messages: [
        {
          role: 'system',
          content: `Calculate comprehensive KPIs for financial analysis using Grok 4 Fast reasoning capabilities.`
        },
        {
          role: 'user',
          content: `Calculate key performance indicators from this financial data:

2024:
${JSON.stringify(data2024, null, 2)}

2025:
${JSON.stringify(data2025, null, 2)}

Calculate:
1. Revenue growth rate (%)
2. Profit margin (%)
3. Return on assets (%)
4. Debt-to-equity ratio
5. Current ratio
6. Working capital change
7. Cash flow adequacy

Provide calculations and interpretations.`
        }
      ],
      reasoning: { enabled: true },
      max_tokens: 4000,
      temperature: 0.1
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.error.message || 'Failed to calculate KPIs');
    }

    return JSON.parse(response.data.choices[0].message.content as string);
  }

  async generateFinancialNotes(
    reportData: ReportData
  ): Promise<Array<{ noteNumber: number; title: string; content: string }>> {
    const response = await this.apiClient.chatCompletion({
      model: 'x-ai/grok-4-fast',
      messages: [
        {
          role: 'system',
          content: `Generate comprehensive notes to financial statements using Grok 4 Fast analysis capabilities.`
        },
        {
          role: 'user',
          content: `Generate detailed notes for this financial report:

${JSON.stringify(reportData, null, 2)}

Include notes for:
1. Significant accounting policies
2. Revenue recognition methods
3. Asset valuation approaches
4. Contingent liabilities
5. Related party transactions
6. Subsequent events
7. Financial risk factors

Format as numbered notes with clear titles and detailed explanations.`
        }
      ],
      reasoning: { enabled: true },
      max_tokens: 6000,
      temperature: 0.2
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.error.message || 'Failed to generate financial notes');
    }

    return JSON.parse(response.data.choices[0].message.content as string);
  }

  async validateFinancialCalculations(
    reportData: ReportData
  ): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    const response = await this.apiClient.chatCompletion({
      model: 'x-ai/grok-4-fast',
      messages: [
        {
          role: 'system',
          content: `Validate financial calculations and mathematical consistency using Grok 4 Fast reasoning.`
        },
        {
          role: 'user',
          content: `Validate all calculations in this financial report:

${JSON.stringify(reportData, null, 2)}

Check for:
1. Balance sheet equation (Assets = Liabilities + Equity)
2. Income statement math (Revenue - Expenses = Profit)
3. Cash flow consistency
4. Year-over-year calculation accuracy
5. KPI calculation correctness

Report any errors, inconsistencies, or calculation mistakes.`
        }
      ],
      reasoning: { enabled: true },
      max_tokens: 4000,
      temperature: 0.1
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.error.message || 'Failed to validate calculations');
    }

    return JSON.parse(response.data.choices[0].message.content as string);
  }
}