import type { ReportData, VerificationResult, VerificationCheck, FinancialItem } from '../types';
import { errorHandler, ErrorType, ErrorSeverity } from './errorHandler';
import { logger } from '../utils/logger';

const TOLERANCE = 1.0; // Allow for a $1 rounding difference

const formatCurrency = (value: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);

const sumItems = (items: FinancialItem[] | undefined): number => {
    if (!items) return 0;
    return items.reduce((acc, item) => acc + item.amount2025, 0);
};

export const verifyReportData = (data: ReportData): VerificationResult => {
  try {
    logger.debug('Starting financial report verification', {
      hasIncomeStatement: !!data.incomeStatement,
      hasBalanceSheet: !!data.balanceSheet,
      hasCashFlowStatement: !!data.cashFlowStatement
    });

    const checks: VerificationCheck[] = [];
    const { incomeStatement, balanceSheet, cashFlowStatement } = data;

    // Validate required data exists
    if (!incomeStatement || !balanceSheet || !cashFlowStatement) {
      const appError = errorHandler.handleError(
        'Missing required financial statement data for verification',
        ErrorType.VALIDATION,
        ErrorSeverity.HIGH,
        {
          hasIncomeStatement: !!incomeStatement,
          hasBalanceSheet: !!balanceSheet,
          hasCashFlowStatement: !!cashFlowStatement
        }
      );
      
      return {
        overallStatus: 'Failed',
        checks: [{
          name: 'Data Completeness Check',
          principle: 'All financial statements must be present',
          calculation: 'N/A',
          reported: 'N/A',
          discrepancy: 0,
          passed: false,
          notes: errorHandler.getUserMessage(appError)
        }],
        timestamp: new Date().toUTCString(),
      };
    }

    // 1. Balance Sheet Equation Check (Assets = Liabilities + Equity)
    const checkBalanceSheet = (year: '2025' | '2024') => {
        const yearSuffix = year === '2025' ? 'amount2025' : 'amount2024';
        const totalAssets = balanceSheet?.totalAssets?.[yearSuffix];
        const totalLiabilities = balanceSheet?.totalLiabilities?.[yearSuffix];
        const totalEquity = balanceSheet?.totalEquity?.[yearSuffix];

        if (totalAssets === undefined || totalLiabilities === undefined || totalEquity === undefined) {
            logger.warn('Missing total values for balance sheet verification', {
              year,
              hasTotalAssets: totalAssets !== undefined,
              hasTotalLiabilities: totalLiabilities !== undefined,
              hasTotalEquity: totalEquity !== undefined
            });
            
            checks.push({
                name: `Balance Sheet Equation (${year})`,
                principle: 'Assets = Liabilities + Equity',
                calculation: 'N/A',
                reported: 'N/A',
                discrepancy: 0,
                passed: false,
                notes: 'Verification skipped due to missing total values in the report data.'
            });
            return;
        }

        const calculatedAssets = totalLiabilities + totalEquity;
        const discrepancy = totalAssets - calculatedAssets;

        checks.push({
            name: `Balance Sheet Equation (${year})`,
            principle: 'Assets = Liabilities + Equity',
            calculation: `${formatCurrency(totalLiabilities)} (Liabilities) + ${formatCurrency(totalEquity)} (Equity) = ${formatCurrency(calculatedAssets)}`,
            reported: `Reported Assets: ${formatCurrency(totalAssets)}`,
            discrepancy,
            passed: Math.abs(discrepancy) <= TOLERANCE,
        });
    };
    checkBalanceSheet('2025');
    checkBalanceSheet('2024');

    // 2. Income Statement Integrity Check (Revenue - Expenses = Net Profit)
    const checkIncomeStatement = (year: '2025' | '2024') => {
        const yearSuffix = year === '2025' ? 'amount2025' : 'amount2024';
        const totalRevenue = incomeStatement?.revenue?.reduce((sum, item) => sum + item[yearSuffix], 0) || 0;
        const totalExpenses = incomeStatement?.expenses?.reduce((sum, item) => sum + item[yearSuffix], 0) || 0;
        const netProfit = incomeStatement?.netProfit?.[yearSuffix];
        
        if (netProfit === undefined) {
            logger.warn('Missing net profit for income statement verification', {
              year,
              totalRevenue,
              totalExpenses
            });
            
            checks.push({
                name: `Income Statement Integrity (${year})`,
                principle: 'Revenue - Expenses = Net Profit',
                calculation: 'N/A',
                reported: 'N/A',
                discrepancy: 0,
                passed: false,
                notes: 'Verification skipped due to missing Net Profit value.'
            });
            return;
        }

        const calculatedNetProfit = totalRevenue - totalExpenses;
        const discrepancy = netProfit - calculatedNetProfit;

        checks.push({
            name: `Income Statement Integrity (${year})`,
            principle: 'Revenue - Expenses = Net Profit',
            calculation: `${formatCurrency(totalRevenue)} (Revenue) - ${formatCurrency(totalExpenses)} (Expenses) = ${formatCurrency(calculatedNetProfit)}`,
            reported: `Reported Net Profit: ${formatCurrency(netProfit)}`,
            discrepancy,
            passed: Math.abs(discrepancy) <= TOLERANCE,
        });
    };
    checkIncomeStatement('2025');
    checkIncomeStatement('2024');

    // 3. Cash Flow Statement Integrity Check
    const checkCashFlowStatement = (year: '2025' | '2024') => {
        const yearSuffix = year === '2025' ? 'amount2025' : 'amount2024';
        const operating = cashFlowStatement?.operatingActivities?.reduce((sum, item) => sum + item[yearSuffix], 0) || 0;
        const investing = cashFlowStatement?.investingActivities?.reduce((sum, item) => sum + item[yearSuffix], 0) || 0;
        const financing = cashFlowStatement?.financingActivities?.reduce((sum, item) => sum + item[yearSuffix], 0) || 0;
        const netChangeInCash = cashFlowStatement?.netChangeInCash?.[yearSuffix];

        if (netChangeInCash === undefined) {
            logger.warn('Missing net change in cash for cash flow verification', {
              year,
              operating,
              investing,
              financing
            });
            
            checks.push({
                name: `Cash Flow Integrity (${year})`,
                principle: 'Operating + Investing + Financing = Net Change in Cash',
                calculation: 'N/A',
                reported: 'N/A',
                discrepancy: 0,
                passed: false,
                notes: 'Verification skipped due to missing Net Change in Cash value.'
            });
            return;
        }

        const calculatedNetChange = operating + investing + financing;
        const discrepancy = netChangeInCash - calculatedNetChange;
        
        checks.push({
            name: `Cash Flow Integrity (${year})`,
            principle: 'Operating + Investing + Financing = Net Change in Cash',
            calculation: `${formatCurrency(operating)} + ${formatCurrency(investing)} + ${formatCurrency(financing)} = ${formatCurrency(calculatedNetChange)}`,
            reported: `Reported Net Change: ${formatCurrency(netChangeInCash)}`,
            discrepancy,
            passed: Math.abs(discrepancy) <= TOLERANCE,
        });
    };
    checkCashFlowStatement('2025');
    checkCashFlowStatement('2024');

    // Determine overall status
    const failedChecks = checks.filter(c => !c.passed).length;
    const warningChecks = checks.filter(c => c.notes && !c.passed).length; // Checks that failed due to missing data
    let overallStatus: VerificationResult['overallStatus'] = 'Passed';
    if (failedChecks > 0) {
        overallStatus = 'Failed';
    } else if (warningChecks > 0) {
        overallStatus = 'Passed with Warnings';
    }

    const result: VerificationResult = {
        overallStatus,
        checks,
        timestamp: new Date().toUTCString(),
    };

    logger.info('Financial report verification completed', {
      status: overallStatus,
      totalChecks: checks.length,
      passedChecks: checks.filter(c => c.passed).length,
      failedChecks: failedChecks,
      warningChecks: warningChecks
    });

    return result;
  } catch (error) {
    logger.error('Error during financial report verification', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    const appError = errorHandler.handleError(
      error instanceof Error ? error : new Error('Verification process failed'),
      ErrorType.SYSTEM,
      ErrorSeverity.HIGH,
      { 
        phase: 'verification',
        originalError: error instanceof Error ? error.message : String(error)
      }
    );
    
    return {
      overallStatus: 'Failed',
      checks: [{
        name: 'Verification Process Error',
        principle: 'N/A',
        calculation: 'N/A',
        reported: 'N/A',
        discrepancy: 0,
        passed: false,
        notes: errorHandler.getUserMessage(appError)
      }],
      timestamp: new Date().toUTCString(),
    };
  }
};