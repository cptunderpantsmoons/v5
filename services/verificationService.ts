import type { ReportData, VerificationResult, VerificationCheck, FinancialItem } from '../types';

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
    const checks: VerificationCheck[] = [];
    const { incomeStatement, balanceSheet, cashFlowStatement } = data;

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

    // 2. Income Statement Integrity Check (Revenue - Expenses = Net Profit)
    const checkIncomeStatement = (year: '2025' | '2024') => {
        const yearSuffix = year === '2025' ? 'amount2025' : 'amount2024';
        const totalRevenue = incomeStatement?.revenue?.reduce((sum, item) => sum + item[yearSuffix], 0) || 0;
        const totalExpenses = incomeStatement?.expenses?.reduce((sum, item) => sum + item[yearSuffix], 0) || 0;
        const netProfit = incomeStatement?.netProfit?.[yearSuffix];
        
        if (netProfit === undefined) {
            const errorMsg = `Missing net profit for ${year}`;
            logVerificationError(errorMsg, 'Income Statement Check');
            
            checks.push({
                name: `Income Statement Integrity (${year})`,
                principle: 'Revenue - Expenses = Net Profit',
                calculation: 'N/A',
                reported: 'N/A',
                discrepancy: 0,
                passed: false,
                notes: 'Verification skipped due to missing net profit data'
            });
            return;
        }

        const calculatedNetProfit = totalRevenue - totalExpenses;
        const discrepancy = netProfit - calculatedNetProfit;

        // Log detailed info only in development
        if (Math.abs(discrepancy) > TOLERANCE) {
            const errorMsg = `Income statement calculation error for ${year}: Revenue=${formatCurrency(totalRevenue)}, Expenses=${formatCurrency(totalExpenses)}, Expected=${formatCurrency(calculatedNetProfit)}, Reported=${formatCurrency(netProfit)}`;
            logVerificationError(errorMsg, 'Income Statement Check');
        }

        checks.push({
            name: `Income Statement Integrity (${year})`,
            principle: 'Revenue - Expenses = Net Profit',
            calculation: `${formatCurrency(totalRevenue)} (Revenue) - ${formatCurrency(totalExpenses)} (Expenses) = ${formatCurrency(calculatedNetProfit)}`,
            reported: `Reported Net Profit: ${formatCurrency(netProfit)}`,
            discrepancy,
            passed: Math.abs(discrepancy) <= TOLERANCE,
        });
    }
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
            const errorMsg = `Missing net change in cash for ${year}`;
            logVerificationError(errorMsg, 'Cash Flow Check');
            
            checks.push({
                name: `Cash Flow Integrity (${year})`,
                principle: 'Operating + Investing + Financing = Net Change in Cash',
                calculation: 'N/A',
                reported: 'N/A',
                discrepancy: 0,
                passed: false,
                notes: 'Verification skipped due to missing cash flow data'
            });
            return;
        }

        const calculatedNetChange = operating + investing + financing;
        const discrepancy = netChangeInCash - calculatedNetChange;
        
        // Log detailed info only in development
        if (Math.abs(discrepancy) > TOLERANCE) {
            const errorMsg = `Cash flow calculation error for ${year}: Operating=${formatCurrency(operating)}, Investing=${formatCurrency(investing)}, Financing=${formatCurrency(financing)}, Expected=${formatCurrency(calculatedNetChange)}, Reported=${formatCurrency(netChangeInCash)}`;
            logVerificationError(errorMsg, 'Cash Flow Check');
        }
        
        checks.push({
            name: `Cash Flow Integrity (${year})`,
            principle: 'Operating + Investing + Financing = Net Change in Cash',
            calculation: `${formatCurrency(operating)} + ${formatCurrency(investing)} + ${formatCurrency(financing)} = ${formatCurrency(calculatedNetChange)}`,
            reported: `Reported Net Change: ${formatCurrency(netChangeInCash)}`,
            discrepancy,
            passed: Math.abs(discrepancy) <= TOLERANCE,
        });
    }
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

    // Log overall verification result
    if (isDevelopment) {
        console.log(`[Verification] Overall status: ${overallStatus}, Failed checks: ${failedChecks}, Warning checks: ${warningChecks}`);
    }

    return {
        overallStatus,
        checks,
        timestamp: new Date().toUTCString(),
    };
};