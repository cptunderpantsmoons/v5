import jsPDF from 'jspdf';
import type { ReportData, VerificationResult } from '../types';
import { errorHandler, ErrorType, ErrorSeverity } from './errorHandler';
import { logger } from '../utils/logger';

// This tells TypeScript that a global variable `XLSX` will exist at runtime (loaded via index.html script tag)
declare const XLSX: any;

interface ApiConfig {
  provider: 'zai';
  apiKey: string;
  model: string;
}

// Convert supported files to base64 parts (Excel -> PDF first for consistency)
async function fileToPart(file: File): Promise<{ inlineData: { data: string; mimeType: string } }> {
  const excelMimeTypes = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];

  if (excelMimeTypes.includes(file.type)) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);

      const pdf = new jsPDF();
      pdf.setFont('courier', 'normal');
      pdf.setFontSize(8);
      const pageHeight = pdf.internal.pageSize.height;
      const margin = 10;
      let y = margin;

      workbook.SheetNames.forEach((sheetName: string, idx: number) => {
        if (idx > 0) pdf.addPage();
        y = margin;
        pdf.text(`Sheet: ${sheetName}`, margin, y);
        y += 10;
        const ws = workbook.Sheets[sheetName];
        const data: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        data.forEach((row) => {
          if (y > pageHeight - margin) {
            pdf.addPage();
            y = margin;
          }
          const rowText = row.map((c) => (c ?? '')).join(' | ');
          pdf.text(rowText, margin, y);
          y += 5;
        });
      });

      const pdfDataUri = pdf.output('datauristring');
      const base64 = pdfDataUri.split(',')[1];
      return { inlineData: { data: base64, mimeType: 'application/pdf' } };
    } catch (error) {
      const appError = errorHandler.handleError(
        error instanceof Error ? error : new Error('Failed to convert Excel file to PDF'),
        ErrorType.VALIDATION,
        ErrorSeverity.MEDIUM,
        { 
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size
        }
      );
      throw new Error(errorHandler.getUserMessage(appError));
    }
  }

  try {
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = () => {
        throw new Error('Failed to read file');
      };
      reader.readAsDataURL(file);
    });

    return { inlineData: { data: base64, mimeType: file.type } };
  } catch (error) {
    const appError = errorHandler.handleError(
      error instanceof Error ? error : new Error('Failed to process file'),
      ErrorType.VALIDATION,
      ErrorSeverity.MEDIUM,
      { 
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size
      }
    );
    throw new Error(errorHandler.getUserMessage(appError));
  }
}

const KNOWLEDGE_BASE = `
You are an expert financial analyst. Before you begin your main task, you MUST study and use the following knowledge base to ensure 100% accuracy in your calculations and terminology.

### Financial Formulas and Calculations
Use these standard formulas for all calculations.

- **Current Ratio:** Current Ratio = Current Assets / Current Liabilities
  - Explanation: Measures a company's ability to pay short-term obligations.
- **Quick Ratio (Acid-Test Ratio):** Quick Ratio = (Current Assets - Inventories) / Current Liabilities
  - Explanation: A more stringent liquidity test that excludes less liquid inventory.
- **Debt-to-Equity Ratio:** Debt-to-Equity Ratio = Total Liabilities / Shareholders' Equity
  - Explanation: Indicates the relative proportion of shareholders' equity and debt used to finance a company's assets.
- **Return on Assets (ROA):** ROA = (Net Income / Total Assets) × 100
  - Explanation: An indicator of how profitable a company is relative to its total assets.
- **Return on Equity (ROE):** ROE = (Net Income / Shareholder's Equity) × 100
  - Explanation: Measures the rate of return on the ownership interest (shareholders' equity) of the common stock owners.
- **Inventory Turnover:** Inventory Turnover = Cost of Goods Sold / Average Inventory
  - Explanation: Shows how many times a company has sold and replaced inventory during a given period.

### Glossary of Financial Terms
Refer to these definitions for precise terminology.

- **Cost of Revenue:** The aggregate cost of goods produced and sold and services rendered during the reporting period.
- **Goodwill:** An asset representing the future economic benefits arising from other assets acquired in a business combination that are not individually identified and separately recognized.
- **Accrued Liabilities:** Amount of obligations incurred and payable, pertaining to costs that are statutory in nature, incurred on contractual obligations, or accumulate over time and for which invoices have not yet been received or will not be rendered.
- **Retained Earnings:** The amount of net income left over for the business after it has paid out dividends to its shareholders.
- **Capital Expenditures (Capex):** Funds used by a company to acquire, upgrade, and maintain physical assets such as property, plants, buildings, technology, or equipment. In a cash flow statement, this is typically represented by 'Purchases of property, plant and equipment'.
`;

const basePrompt = () => `
You are a meticulous and expert senior accountant acting as a Certified Public Accountant (CPA). I am providing you with two financial documents for a company.
- Document 1: The complete and final financial statement for the year 2024.
- Document 2: The current, raw financial data for the 2025 period.

Your primary task is to construct the full 2025 financial statements, perform a comparative analysis against 2024, and output the result as a single, perfectly structured JSON object.

CRITICAL: Your output MUST be mathematically consistent and adhere to the schema I will describe. Ensure all monetary values are numbers (no symbols) and negatives use a minus sign.
`;

const ZAI_BASE_URL = (process.env.ZAI_API_BASE as string) || 'https://api.zai.ai/v1';

async function callZai(messages: any[], apiKey?: string, model?: string) {
  const key = apiKey || (process.env.ZAI_API_KEY as string);
  if (!key) {
    const appError = errorHandler.handleError(
      'API key is missing. Please set ZAI_API_KEY in your environment.',
      ErrorType.AUTHENTICATION,
      ErrorSeverity.HIGH
    );
    throw new Error(errorHandler.getUserMessage(appError));
  }

  try {
    const res = await fetch(`${ZAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'zai-model-1',
        response_format: { type: 'json_object' },
        messages,
      }),
    });

    if (!res.ok) {
      // Sanitize error message - don't expose API endpoint details to users
      const errorText = await res.text();
      logger.error('ZAI API error response', {
        status: res.status,
        statusText: res.statusText,
        // Don't log the actual error body as it might contain sensitive info
      });
      
      const appError = errorHandler.handleError(
        `API request failed with status ${res.status}`,
        ErrorType.NETWORK,
        ErrorSeverity.MEDIUM,
        { 
          status: res.status,
          endpoint: 'chat/completions' // Safe to log endpoint name
        }
      );
      throw new Error(errorHandler.getUserMessage(appError));
    }
    
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      const appError = errorHandler.handleError(
        'API returned an unexpected response format',
        ErrorType.NETWORK,
        ErrorSeverity.MEDIUM,
        { 
          hasContent: !!content,
          contentType: typeof content
        }
      );
      throw new Error(errorHandler.getUserMessage(appError));
    }
    return content as string;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      // Network-related errors
      const appError = errorHandler.handleError(
        'Network connection failed. Please check your internet connection.',
        ErrorType.NETWORK,
        ErrorSeverity.MEDIUM,
        { 
          errorType: 'network',
          originalError: error.message
        }
      );
      throw new Error(errorHandler.getUserMessage(appError));
    }
    
    // Re-throw already handled errors
    if (error instanceof Error && error.message.includes('API key') || error.message.includes('API request failed')) {
      throw error;
    }
    
    // Unexpected errors
    const appError = errorHandler.handleError(
      error instanceof Error ? error : new Error('Unknown error occurred'),
      ErrorType.SYSTEM,
      ErrorSeverity.HIGH,
      { 
        originalError: error instanceof Error ? error.message : String(error)
      }
    );
    throw new Error(errorHandler.getUserMessage(appError));
  }
}

export async function generateFinancialReport(file2024: File, file2025: File, config: ApiConfig): Promise<ReportData> {
  logger.info('Starting financial report generation', {
    file2024Name: file2024.name,
    file2025Name: file2025.name,
    model: config.model
  });

  try {
    const prompt = KNOWLEDGE_BASE + basePrompt() + `\nNow output a single JSON object with these keys: summary, kpis, abn, directorsDeclaration, incomeStatement, balanceSheet, cashFlowStatement, notesToFinancialStatements.`;

    const part2024 = await fileToPart(file2024);
    const part2025 = await fileToPart(file2025);

    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${part2024.inlineData.mimeType};base64,${part2024.inlineData.data}` } },
          { type: 'image_url', image_url: { url: `data:${part2025.inlineData.mimeType};base64,${part2025.inlineData.data}` } },
        ],
      },
    ];

    const jsonText = await callZai(messages, config.apiKey, config.model);
    
    try {
      const parsedData = JSON.parse(jsonText) as ReportData;
      logger.info('Successfully generated financial report');
      return parsedData;
    } catch (parseError) {
      const appError = errorHandler.handleError(
        'AI returned data in an invalid format. Please try again.',
        ErrorType.SYSTEM,
        ErrorSeverity.MEDIUM,
        { 
          parseError: parseError instanceof Error ? parseError.message : 'JSON parse failed'
        }
      );
      throw new Error(errorHandler.getUserMessage(appError));
    }
  } catch (error) {
    if (error instanceof Error && (error.message.includes('API key') || error.message.includes('API request failed') || error.message.includes('Network connection failed') || error.message.includes('AI returned data'))) {
      // Re-throw our sanitized errors
      throw error;
    }
    
    // Unexpected errors during report generation
    const appError = errorHandler.handleError(
      'Failed to generate financial report. Please check your documents and try again.',
      ErrorType.SYSTEM,
      ErrorSeverity.HIGH,
      { 
        originalError: error instanceof Error ? error.message : String(error),
        phase: 'report_generation'
      }
    );
    throw new Error(errorHandler.getUserMessage(appError));
  }
}

const formatCurrency = (v: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(v);

function generateErrorCorrectionInstructions(errors: VerificationResult, previousReport: ReportData): string {
  const failed = errors.checks.filter((c) => !c.passed);
  if (failed.length === 0) return 'No errors found.';

  return failed
    .map((check) => {
      const yearMatch = check.name.match(/\((2024|2025)\)/);
      const year = (yearMatch ? yearMatch[1] : 'the relevant year') as '2024' | '2025';
      const key = year === '2025' ? 'amount2025' : 'amount2024';

      if (check.name.includes('Balance Sheet Equation')) {
        const a = previousReport.balanceSheet.totalAssets[key];
        const l = previousReport.balanceSheet.totalLiabilities[key];
        const e = previousReport.balanceSheet.totalEquity[key];
        const discrepancy = a - (l + e);
        return `- ${check.name}: Assets (${formatCurrency(a)}) != Liabilities (${formatCurrency(l)}) + Equity (${formatCurrency(e)}). Discrepancy: ${formatCurrency(discrepancy)}.\nAction: Recalculate totals from items; if still off, adjust an equity item (e.g., Retained Earnings) so Assets = Liabilities + Equity.`;
      }
      if (check.name.includes('Income Statement Integrity')) {
        const np = previousReport.incomeStatement.netProfit[key];
        const rev = previousReport.incomeStatement.revenue.reduce((s, it) => s + (it as any)[key], 0);
        const exp = previousReport.incomeStatement.expenses.reduce((s, it) => s + (it as any)[key], 0);
        const calc = rev - exp;
        return `- ${check.name}: Reported Net Profit ${formatCurrency(np)} != ${formatCurrency(calc)} (Revenue - Expenses). Action: Set netProfit.${key} to ${calc}.`;
      }
      if (check.name.includes('Cash Flow Integrity')) {
        const n = previousReport.cashFlowStatement.netChangeInCash[key];
        const op = previousReport.cashFlowStatement.operatingActivities.reduce((s, it) => s + (it as any)[key], 0);
        const inv = previousReport.cashFlowStatement.investingActivities.reduce((s, it) => s + (it as any)[key], 0);
        const fin = previousReport.cashFlowStatement.financingActivities.reduce((s, it) => s + (it as any)[key], 0);
        const calc = op + inv + fin;
        return `- ${check.name}: Reported Net Change ${formatCurrency(n)} != ${formatCurrency(calc)} (sum of activities). Action: Set netChangeInCash.${key} to ${calc}.`;
      }
      return `- ${check.name}: Please correct. Discrepancy: ${formatCurrency(check.discrepancy)}.`;
    })
    .join('\n\n');
}

export async function fixFinancialReport(previousReport: ReportData, verificationErrors: VerificationResult, config: ApiConfig): Promise<ReportData> {
  logger.info('Starting financial report correction', {
    failedChecksCount: verificationErrors.checks.filter(c => !c.passed).length,
    model: config.model
  });

  try {
    const instructions = generateErrorCorrectionInstructions(verificationErrors, previousReport);
    const prompt = `You previously generated a financial report JSON that failed verification. Apply ONLY the corrections below and output the full corrected JSON. Do not add any extra text.\n\nREPORT TO FIX:\n${JSON.stringify(previousReport)}\n\nCORRECTIONS:\n${instructions}`;

    const messages = [
      { role: 'user', content: [{ type: 'text', text: prompt }] },
    ];

    const jsonText = await callZai(messages, config.apiKey, config.model);
    
    try {
      const correctedData = JSON.parse(jsonText) as ReportData;
      logger.info('Successfully corrected financial report');
      return correctedData;
    } catch (parseError) {
      const appError = errorHandler.handleError(
        'AI returned corrected data in an invalid format. Please try again.',
        ErrorType.SYSTEM,
        ErrorSeverity.MEDIUM,
        { 
          parseError: parseError instanceof Error ? parseError.message : 'JSON parse failed',
          phase: 'correction'
        }
      );
      throw new Error(errorHandler.getUserMessage(appError));
    }
  } catch (error) {
    if (error instanceof Error && (error.message.includes('API key') || error.message.includes('API request failed') || error.message.includes('Network connection failed') || error.message.includes('AI returned data'))) {
      // Re-throw our sanitized errors
      throw error;
    }
    
    // Unexpected errors during report correction
    const appError = errorHandler.handleError(
      'Failed to correct financial report. Please try generating a new report.',
      ErrorType.SYSTEM,
      ErrorSeverity.HIGH,
      { 
        originalError: error instanceof Error ? error.message : String(error),
        phase: 'report_correction'
      }
    );
    throw new Error(errorHandler.getUserMessage(appError));
  }
}