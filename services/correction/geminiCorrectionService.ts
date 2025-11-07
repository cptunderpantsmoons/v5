import type { 
  OpenRouterRequest, 
  OpenRouterMessage,
  ApiResponse
} from '../types/openRouter';
import { getOpenRouterClient } from '../api/openRouterClient';
import type { ReportData } from '../analysis/grokAnalysisService';

export interface VerificationResult {
  overallStatus: 'Passed' | 'Failed';
  checks: Array<{
    name: string;
    calculation: string;
    reported: string;
    discrepancy: number;
    passed: boolean;
  }>;
  timestamp: string;
}

export interface CorrectedReportData extends ReportData {
  correctionAttempts: number;
  finalVerificationStatus: string;
}

export class GeminiCorrectionService {
  private apiClient = getOpenRouterClient();

  async fixFinancialReport(
    reportData: ReportData,
    verification: VerificationResult,
    maxAttempts: number = 3
  ): Promise<CorrectedReportData> {
    let currentReport = { ...reportData };
    let currentVerification = verification;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (currentVerification.overallStatus === 'Passed') {
        break;
      }

      console.log(`Correction attempt ${attempt}/${maxAttempts}`);
      
      const response = await this.apiClient.chatCompletion({
        model: 'google/gemini-2.0-flash-exp',
        messages: [
          {
            role: 'system',
            content: `You are a financial verification expert. Fix mathematical errors and inconsistencies.
              Use Gemini 2.0 Flash for fast, accurate corrections.
              Focus on balance sheet equations, profit calculations, and cash flow consistency.`
          },
          {
            role: 'user',
            content: `Fix these verification errors in the financial report:

Current Report:
${JSON.stringify(currentReport, null, 2)}

Verification Issues:
${currentVerification.checks
  .filter(check => !check.passed)
  .map(check => `- ${check.name}: ${check.calculation} ≠ ${check.reported} (discrepancy: ${check.discrepancy})`)
  .join('\n')}

Correct the errors while preserving valid data. Ensure all calculations are mathematically sound.`
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4000,
        temperature: 0.1 // Low temperature for precision
      });

      if (!response.success || !response.data) {
        throw new Error(response.error?.error.message || 'Failed to correct financial report');
      }

      const messageContent = response.data.choices[0].message.content;
      if (typeof messageContent === 'string') {
        currentReport = JSON.parse(messageContent);
      } else {
        // Handle case where content might be an array of content objects
        const textContent = messageContent.find((content: any) => content.type === 'text')?.text || '';
        currentReport = JSON.parse(textContent);
      }
      
      currentVerification = await this.verifyReportData(currentReport);
    }

    return {
      ...currentReport,
      correctionAttempts: maxAttempts,
      finalVerificationStatus: currentVerification.overallStatus,
      modelUsed: 'google/gemini-2.0-flash-exp',
      cost: 0 // Free correction
    };
  }

  async quickErrorCorrection(
    reportData: ReportData,
    specificErrors: string[]
  ): Promise<ReportData> {
    const response = await this.apiClient.chatCompletion({
      model: 'google/gemini-2.0-flash-exp',
      messages: [
        {
          role: 'system',
          content: `Quickly fix specific financial calculation errors using Gemini 2.0 Flash.`
        },
        {
          role: 'user',
          content: `Fix these specific errors in the financial report:

Current Report:
${JSON.stringify(reportData, null, 2)}

Specific Errors to Fix:
${specificErrors.map(error => `- ${error}`).join('\n')}

Make targeted corrections only for the identified errors.`
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
      temperature: 0.1
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.error.message || 'Failed to fix specific errors');
    }

    const messageContent = response.data.choices[0].message.content;
    if (typeof messageContent === 'string') {
      return JSON.parse(messageContent);
    } else {
      const textContent = messageContent.find((content: any) => content.type === 'text')?.text || '';
      return JSON.parse(textContent);
    }
  }

  async validateCalculations(
    reportData: ReportData
  ): Promise<VerificationResult> {
    const response = await this.apiClient.chatCompletion({
      model: 'google/gemini-2.0-flash-exp',
      messages: [
        {
          role: 'system',
          content: `Validate financial calculations and mathematical consistency using Gemini 2.0 Flash.`
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

Return validation results with specific error details.`
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 3000,
      temperature: 0.1
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.error.message || 'Failed to validate calculations');
    }

    const messageContent = response.data.choices[0].message.content;
    if (typeof messageContent === 'string') {
      return JSON.parse(messageContent);
    } else {
      const textContent = messageContent.find((content: any) => content.type === 'text')?.text || '';
      return JSON.parse(textContent);
    }
  }

  async autoCorrectReport(
    reportData: ReportData
  ): Promise<{ correctedReport: CorrectedReportData; corrections: string[] }> {
    const verification = await this.verifyReportData(reportData);
    
    if (verification.overallStatus === 'Passed') {
      return {
        correctedReport: {
          ...reportData,
          correctionAttempts: 0,
          finalVerificationStatus: 'Passed',
          modelUsed: 'google/gemini-2.0-flash-exp',
          cost: 0
        },
        corrections: []
      };
    }

    const correctedReport = await this.fixFinancialReport(reportData, verification);
    const finalVerification = await this.verifyReportData(correctedReport);
    
    const corrections = verification.checks
      .filter(check => !check.passed)
      .map(check => `Fixed ${check.name}: ${check.discrepancy} discrepancy`);

    return {
      correctedReport,
      corrections
    };
  }

  private async verifyReportData(reportData: ReportData): Promise<VerificationResult> {
    const response = await this.apiClient.chatCompletion({
      model: 'google/gemini-2.0-flash-exp',
      messages: [
        {
          role: 'system',
          content: `Perform mathematical verification of financial report calculations.`
        },
        {
          role: 'user',
          content: `Verify mathematical accuracy of this financial report:

${JSON.stringify(reportData, null, 2)}

Check:
1. Balance sheet totals match
2. Income statement calculations
3. Cash flow consistency
4. KPI calculation correctness

Return detailed verification results.`
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 3000,
      temperature: 0.1
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.error.message || 'Failed to verify report data');
    }

    const messageContent = response.data.choices[0].message.content;
    let verification;
    
    if (typeof messageContent === 'string') {
      verification = JSON.parse(messageContent);
    } else {
      const textContent = messageContent.find((content: any) => content.type === 'text')?.text || '';
      verification = JSON.parse(textContent);
    }
    
    // Ensure verification has required structure
    return {
      overallStatus: verification.overallStatus || 'Failed',
      checks: verification.checks || [],
      timestamp: new Date().toISOString()
    };
  }
}