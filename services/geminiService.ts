import type { ReportData as BaseReportData, VerificationResult as BaseVerificationResult } from '../types';

export type ReportData = BaseReportData & {
  companyName?: string;
  reportYear?: string;
  dateGenerated?: string;
};

export type VerificationResult = BaseVerificationResult;

export type ApiConfig = {
  provider: 'gemini' | 'openrouter';
  apiKey: string;
  model: string;
  voiceModel: string;
};

export async function generateFinancialReport(
  file2024: File,
  file2025: File,
  apiConfig: ApiConfig
): Promise<ReportData> {
  console.log('Generating financial report with config:', apiConfig);
  
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return {
    summary: 'Financial report generated successfully.',
    kpis: [
      { name: 'Revenue Growth', value2025: '15%', value2024: '10%', changePercentage: 5.0 },
      { name: 'Profit Margin', value2025: '20%', value2024: '18%', changePercentage: 2.0 },
      { name: 'Return on Equity', value2025: '22%', value2024: '20%', changePercentage: 2.0 }
    ],
    abn: '12 345 678 901',
    directorsDeclaration: {
      directors: [
        { name: 'John Director', title: 'Managing Director' }
      ],
      date: new Date().toISOString().split('T')[0]
    },
    incomeStatement: {
      revenue: [
        { item: 'Sales Revenue', amount2025: 1000000, amount2024: 800000 }
      ],
      expenses: [
        { item: 'Operating Expenses', amount2025: 800000, amount2024: 640000 }
      ],
      grossProfit: { amount2025: 200000, amount2024: 160000 },
      operatingIncome: { amount2025: 200000, amount2024: 160000 },
      netProfit: { amount2025: 200000, amount2024: 160000 }
    },
    balanceSheet: {
      currentAssets: [
        { item: 'Cash and Cash Equivalents', amount2025: 500000, amount2024: 400000 }
      ],
      nonCurrentAssets: [
        { item: 'Property, Plant and Equipment', amount2025: 1000000, amount2024: 800000 }
      ],
      currentLiabilities: [
        { item: 'Trade and Other Payables', amount2025: 300000, amount2024: 250000 }
      ],
      nonCurrentLiabilities: [
        { item: 'Long-term Debt', amount2025: 200000, amount2024: 200000 }
      ],
      equity: [
        { item: 'Share Capital', amount2025: 500000, amount2024: 500000 },
        { item: 'Retained Earnings', amount2025: 500000, amount2024: 250000 }
      ],
      totalAssets: { amount2025: 1500000, amount2024: 1200000 },
      totalLiabilities: { amount2025: 500000, amount2024: 450000 },
      totalEquity: { amount2025: 1000000, amount2024: 750000 }
    },
    cashFlowStatement: {
      operatingActivities: [
        { item: 'Net Income', amount2025: 200000, amount2024: 160000 }
      ],
      investingActivities: [
        { item: 'Capital Expenditures', amount2025: -50000, amount2024: -30000 }
      ],
      financingActivities: [
        { item: 'Debt Repayment', amount2025: 0, amount2024: -20000 }
      ],
      netChangeInCash: { amount2025: 150000, amount2024: 110000 }
    },
    notesToFinancialStatements: '## Note 1: Accounting Policies\nThe financial statements have been prepared in accordance with Australian Accounting Standards.',
    companyName: 'Example Company',
    reportYear: '2025',
    dateGenerated: new Date().toISOString()
  };
}

export async function fixFinancialReport(
  reportData: ReportData,
  verification: VerificationResult,
  apiConfig: ApiConfig
): Promise<ReportData> {
  console.log('Fixing financial report with verification:', verification);
  
  // Simulate report fixing
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  return {
    ...reportData,
    dateGenerated: new Date().toISOString()
  };
}

export async function generateAudioSummary(text: string, voiceModel: string): Promise<string> {
  // Simulate audio generation
  await new Promise(resolve => setTimeout(resolve, 1000));
  return `Audio summary generated for: ${text.substring(0, 50)}...`;
}

export async function generateOpenRouterAudioSummary(text: string, voiceModel: string): Promise<string> {
  // Simulate OpenRouter audio generation
  await new Promise(resolve => setTimeout(resolve, 1000));
  return `OpenRouter audio summary generated for: ${text.substring(0, 50)}...`;
}