import type { ReportData, VerificationResult } from '../types';
import type { FinancialItem } from '../types';

const TOLERANCE = 1.0; // Allow for a $1 rounding difference

const formatCurrency = (value: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);

const sumItems = (items: FinancialItem[] | undefined): number => {
    if (!items) return 0;
    return items.reduce((acc, item) => acc + item.amount2025, 0);
};

// Security: Environment-aware error logging
const isDevelopment = process.env.NODE_ENV === 'development';

const logVerificationError = (message: string, context: string) => {
    if (isDevelopment) {
        console.error(`[Verification] ${context}: ${message}`);
    }
    // In production, we could send to a secure logging service here
};

export const verifyReportData = (data: ReportData): VerificationResult => {
    const checks: any[] = [];
    const { incomeStatement, balanceSheet } = data;

    // 1. Balance Sheet Equation Check (Assets = Liabilities + Equity)
    const checkBalanceSheet = (year: '2025' | '2024') => {
        const yearSuffix = year === '2025' ? 'amount2025' : 'amount2024';
        const totalAssets = balanceSheet?.totalAssets?.[yearSuffix];
        const totalLiabilities = balanceSheet?.totalLiabilities?.[yearSuffix];
        const totalEquity = balanceSheet?.totalEquity?.[yearSuffix];

        if (totalAssets === undefined || totalLiabilities === undefined || totalEquity === undefined) {
            const errorMsg = `Missing balance sheet totals for ${year}`;
            logVerificationError(errorMsg, 'Balance Sheet Check');
            
            checks.push({
                name: `Balance Sheet Equation (${year})`,
                principle: 'Assets = Liabilities + Equity',
                calculation: 'N/A',
                reported: 'N/A',
                discrepancy: 0,
                passed: false,
                notes: 'Verification skipped due to missing data'
            });
            return;
        }

        const calculatedAssets = totalLiabilities + totalEquity;
        const discrepancy = totalAssets - calculatedAssets;

        // Log detailed info only in development
        if (Math.abs(discrepancy) > TOLERANCE) {
            const errorMsg = `Balance sheet imbalance for ${year}: Assets=${formatCurrency(totalAssets)}, Liabilities+Equity=${formatCurrency(calculatedAssets)}, Discrepancy=${formatCurrency(discrepancy)}`;
            logVerificationError(errorMsg, 'Balance Sheet Check');
        }

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

    // Determine overall status
    const failedChecks = checks.filter(c => !c.passed).length;
    const warningChecks = checks.filter(c => c.notes && !c.passed).length; // Checks that failed due to missing data
    let overallStatus: 'Passed' | 'Failed' | 'Passed with Warnings' = 'Passed';
    if (failedChecks > 0) {
        overallStatus = 'Failed';
    } else if (warningChecks > 0) {
        overallStatus = 'Passed with Warnings';
    }

    return {
        overallStatus,
        checks,
        timestamp: new Date().toUTCString(),
    };
};