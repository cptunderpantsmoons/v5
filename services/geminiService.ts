export type ReportData = {
  companyName: string;
  reportYear: string;
  kpis: string[];
  abn: string;
  directorsDeclaration: string;
  incomeStatement: {
    totalRevenue: number;
    totalExpenses: number;
    netIncome: number;
    grossProfitMargin: number;
  };
  balanceSheet: {
    totalAssets: number;
    totalLiabilities: number;
    shareholdersEquity: number;
  };
  cashFlowStatement: {
    operatingCashFlow: number;
    investingCashFlow: number;
    financingCashFlow: number;
    netCashFlow: number;
  };
  cashFlow: {
    operatingCashFlow: number;
    investingCashFlow: number;
    financingCashFlow: number;
    netCashFlow: number;
  };
  keyMetrics: {
    currentRatio: number;
    debtToEquity: number;
    returnOnEquity: number;
    profitMargin: number;
  };
  analysis: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  summary: string;
  notesToFinancialStatements: string;
  audioSummary?: string;
  dateGenerated: string;
};

export type VerificationResult = {
  overallStatus: 'Pass' | 'Failed';
  issues: Array<{
    category: 'Mathematical' | 'Inconsistency' | 'Missing';
    description: string;
    severity: 'low' | 'medium' | 'high';
    suggestion: string;
  }>;
  verified: boolean;
  timestamp: string;
};

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
    companyName: 'Example Company',
    reportYear: '2025',
    kpis: ['Revenue Growth: 15%', 'Profit Margin: 20%', 'ROE: 22%'],
    abn: '12 345 678 901',
    directorsDeclaration: 'Directors confirm the financial statements are true and correct',
    incomeStatement: {
      totalRevenue: 1000000,
      totalExpenses: 800000,
      netIncome: 200000,
      grossProfitMargin: 0.2
    },
    balanceSheet: {
      totalAssets: 1500000,
      totalLiabilities: 600000,
      shareholdersEquity: 900000
    },
    cashFlowStatement: {
      operatingCashFlow: 250000,
      investingCashFlow: -50000,
      financingCashFlow: -30000,
      netCashFlow: 170000
    },
    cashFlow: {
      operatingCashFlow: 250000,
      investingCashFlow: -50000,
      financingCashFlow: -30000,
      netCashFlow: 170000
    },
    keyMetrics: {
      currentRatio: 2.5,
      debtToEquity: 0.67,
      returnOnEquity: 0.22,
      profitMargin: 0.2
    },
    analysis: {
      strengths: ['Strong revenue growth', 'Healthy profit margins'],
      weaknesses: ['High operating expenses'],
      opportunities: ['Market expansion', 'Cost optimization'],
      threats: ['Economic uncertainty', 'Competition']
    },
    summary: 'Financial report generated successfully.',
    notesToFinancialStatements: 'Notes to financial statements - to be completed',
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