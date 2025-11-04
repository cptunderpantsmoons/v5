export interface KPI {
  name: string;
  value2025: string;
  value2024: string;
  changePercentage: number;
}

export interface FinancialItem {
  item: string;
  amount2025: number;
  amount2024: number;
  noteRef?: number; // Optional reference to a note ID
}

export interface SingleFinancialValue {
    amount2025: number;
    amount2024: number;
    noteRef?: number; // Optional reference to a note ID
}

export interface DirectorsDeclaration {
    directors: {
        name: string;
        title: string;
    }[];
    date: string;
}

export interface IncomeStatement {
    revenue: FinancialItem[];
    expenses: FinancialItem[];
    grossProfit: SingleFinancialValue;
    operatingIncome: SingleFinancialValue;
    netProfit: SingleFinancialValue;
}

export interface BalanceSheet {
    currentAssets: FinancialItem[];
    nonCurrentAssets: FinancialItem[];
    currentLiabilities: FinancialItem[];
    nonCurrentLiabilities: FinancialItem[];
    equity: FinancialItem[];
    totalAssets: SingleFinancialValue;
    totalLiabilities: SingleFinancialValue;
    totalEquity: SingleFinancialValue;
}

export interface CashFlowStatement {
    operatingActivities: FinancialItem[];
    investingActivities: FinancialItem[];
    financingActivities: FinancialItem[];
    netChangeInCash: SingleFinancialValue;
}

export interface ReportData {
  summary: string;
  kpis: KPI[];
  abn: string;
  directorsDeclaration: DirectorsDeclaration;
  incomeStatement: IncomeStatement;
  balanceSheet: BalanceSheet;
  cashFlowStatement: CashFlowStatement;
  notesToFinancialStatements: string;
}

// Types for the mathematical verification certificate
export interface VerificationCheck {
  name: string;
  principle: string;
  calculation: string;
  reported: string;
  discrepancy: number;
  passed: boolean;
  notes?: string;
}

export interface VerificationResult {
  overallStatus: 'Passed' | 'Failed' | 'Passed with Warnings';
  checks: VerificationCheck[];
  timestamp: string;
}