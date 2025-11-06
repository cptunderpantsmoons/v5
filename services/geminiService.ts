import { GoogleGenAI, Type, Modality } from '@google/genai';
import jsPDF from 'jspdf';
import type { ReportData, VerificationResult } from '../types';

// This tells TypeScript that a global variable `XLSX` will exist at runtime.
// It is loaded via the script tag in index.html, not as a module.
declare const XLSX: any;

interface ApiConfig {
    provider: 'gemini' | 'openrouter';
    apiKey: string;
    model: string;
    voiceModel?: string;
}

// Security: Environment-aware error handling
const isDevelopment = process.env.NODE_ENV === 'development';

const sanitizeError = (error: unknown, context: string): string => {
    // In production, return generic error messages
    if (!isDevelopment) {
        return "An error occurred while processing your request. Please try again.";
    }
    
    // In development, provide helpful details but avoid sensitive information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Only log technical details in development
    console.error(`[${context}] Error details:`, {
        message: errorMessage,
        context,
        timestamp: new Date().toISOString()
    });
    
    return `Development error in ${context}: ${errorMessage}`;
};

// Security: Sanitized file processing with environment-aware error handling
async function fileToGenerativePart(file: File): Promise<{ inlineData: { data: string; mimeType: string; }; }> {
    const excelMimeTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    try {
        if (excelMimeTypes.includes(file.type)) {
            // Per user instruction: convert Excel file to a PDF first.
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer);

            const pdf = new jsPDF();
            pdf.setFont('courier', 'normal'); // Use a monospaced font for table-like alignment
            pdf.setFontSize(8);

            const pageHeight = pdf.internal.pageSize.height;
            const margin = 10;
            let yPosition = margin;

            workbook.SheetNames.forEach((sheetName, index) => {
                if (index > 0) {
                    pdf.addPage();
                }
                yPosition = margin;
                
                pdf.text(`Sheet: ${sheetName}`, margin, yPosition);
                yPosition += 10;

                const worksheet = workbook.Sheets[sheetName];
                // Convert sheet to an array of arrays for easier processing
                const data: string[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                data.forEach(row => {
                    // Check if new line exceeds page height
                    if (yPosition > pageHeight - margin) {
                        pdf.addPage();
                        yPosition = margin;
                    }
                    const rowText = row.map(cell => cell !== null && cell !== undefined ? cell : '').join(' | ');
                    pdf.text(rowText, margin, yPosition);
                    yPosition += 5; // Move to the next line
                });
            });
            
            // Output the generated PDF as a base64 string
            const pdfDataUri = pdf.output('datauristring');
            const base64Data = pdfDataUri.split(',')[1];
            
            return {
                inlineData: {
                    data: base64Data,
                    mimeType: 'application/pdf', // Send the converted file as a PDF
                },
            };
        }

        // For other file types (PDF, images), process as before.
        const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            try {
                // The result includes the Base64 prefix, which we need to remove.
                const base64Data = (reader.result as string).split(',')[1];
                resolve(base64Data);
            } catch (e) {
                reject(new Error('Failed to process file data'));
            }
          };
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });
      
        return {
          inlineData: {
            data: await base64EncodedDataPromise,
            mimeType: file.type,
          },
        };
    } catch (error) {
        throw new Error(sanitizeError(error, 'fileToGenerativePart'));
    }
}

const singleFinancialValueSchema = {
    type: Type.OBJECT,
    properties: {
        amount2025: { type: Type.NUMBER },
        amount2024: { type: Type.NUMBER },
        noteRef: { type: Type.NUMBER, description: "A unique number referencing a detailed note.", nullable: true },
    },
    required: ['amount2025', 'amount2024'],
};

const financialItemsArraySchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            item: { type: Type.STRING },
            amount2025: { type: Type.NUMBER },
            amount2024: { type: Type.NUMBER },
            noteRef: { type: Type.NUMBER, description: "A unique number referencing a detailed note.", nullable: true },
        },
        required: ['item', 'amount2025', 'amount2024'],
    },
};

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

### Financial Benchmarking Examples
Here are examples of how to answer financial questions based on provided text. Use these as a guide for accuracy.

**Example 1:**
- **Question:** What is the FY2018 capital expenditure amount (in USD millions) for 3M?
- **Evidence:** "Cash Flows from Investing Activities... Purchases of property, plant and equipment (PP&E)... (1,577)"
- **Answer:** 1577

**Example 2:**
- **Question:** what is the year end FY2018 net PPNE for 3M? Answer in USD billions.
- **Evidence:** "Property, plant and equipment – net... 8,738" (in millions)
- **Answer:** 8.7

**Example 3:**
- **Question:** Does 3M have a reasonably healthy liquidity profile based on its quick ratio for Q2 of FY2023?
- **Evidence:** "Total current assets 15,754... Total inventories 5,280... Total current liabilities 10,936" (in millions)
- **Calculation:** (Current Assets - Inventories) / Current Liabilities = (15,754 - 5,280) / 10,936 = 0.96
- **Answer:** "No. The quick ratio for 3M was 0.96 by Jun'23 close, which needs a bit of an improvement to touch the 1x mark"

---
`;

const getBasePrompt = () => `
    You are a meticulous and expert senior accountant acting as a Certified Public Accountant (CPA). I am providing you with two financial documents for a company.
    - Document 1: The complete and final financial statement for the year 2024.
    - Document 2: The current, raw financial data for the 2025 period.

    Your primary task is to construct the full 2025 financial statements, perform a comparative analysis against 2024, and output the result as a single, perfectly structured JSON object.

    **CRITICAL ACCURACY INSTRUCTIONS:**
    Your output WILL BE programmatically verified for mathematical integrity. It is IMPERATIVE that the numbers you generate are consistent and balanced. The following equations MUST hold true for both 2025 and 2024 data within your final JSON output. Failure to adhere to these will result in an error.
    1.  **Balance Sheet Equation:** The value for 'totalAssets' MUST equal the sum of 'totalLiabilities' and 'totalEquity'.
    2.  **Income Statement Logic:** The value for 'netProfit' MUST equal the sum of all 'revenue' items minus the sum of all 'expenses' items. The value for 'grossProfit' must equal 'revenue' minus 'cost of goods sold' (or its equivalent).
    3.  **Cash Flow Summation:** The 'netChangeInCash' MUST equal the sum of all items in 'operatingActivities', 'investingActivities', and 'financingActivities'.

    **MAIN TASK & INSTRUCTIONS:**

    1.  **Analyze and Construct:** Thoroughly analyze both documents. Use the 2025 data to construct a full, formal set of 2025 financial statements. Extract the company's ABN.
    2.  **Mimic 2024 Structure:** It is critical that the structure, layout, and style of the 2025 statements and notes closely mimic the 2024 document. If the 2024 income statement lists 'Revenue from services' and 'Revenue from products' separately, you must do the same for 2025. Pay close attention to the ordering of items and the level of detail.
    3.  **MANDATORY Cash Flow Statement**: A detailed Statement of Cash Flows for 2025 is NOT optional. If cash flow data is not explicit, you MUST derive it using the indirect method from the 2025 income statement and the changes between the 2024 and 2025 balance sheets.
    4.  **MANDATORY Notes to the Financial Statements:** This is the most critical part. You MUST generate the entire 'Notes to the Financial Statements' section as a single, cohesive markdown string in the \`notesToFinancialStatements\` field.
        -   The structure MUST be hierarchical and professional, following the 2024 document's format.
        -   Use markdown for formatting:
            -   Main note headings MUST be bolded and numbered, e.g., \`**Note 1: Statement of Significant Accounting Policies**\`.
            -   Sub-headings MUST be bolded and lettered, e.g., \`**(a) Basis of accounting**\`.
            -   Further sub-headings use Roman numerals, e.g., \`**(i) Tax consolidation**\`.
        -   For any line item in the main statements with a \`noteRef\` (e.g., \`noteRef: 5\`), there MUST be a corresponding numbered note in the markdown (e.g., \`**Note 5: Income Tax Expense/(Benefit)**\`). The numbering must be sequential and consistent.
        -   For notes that provide a tabular breakdown of a line item (e.g., 'Property, Plant, and Equipment'), you MUST format this breakdown as a standard GitHub-flavored Markdown table within the note's text.
        -   **Carry Over Standards:** You must identify the accounting standards (e.g., AASB 101) mentioned in the 2024 notes and ensure they are appropriately referenced in the 2025 notes you generate.
    5.  **Directors' Declaration:** From the 2024 document, you must extract the names and titles of the signing directors and the date of the declaration. Populate the \`directorsDeclaration\` object with this information.
    6.  **Calculate KPIs and Summarize:** Calculate standard financial KPIs comparing 2025 to 2024. Write a professional executive summary covering performance, position, and a detailed cash flow analysis.
    
    Now, based on the provided documents, generate a single JSON object that strictly adheres to the provided schema. Ensure all monetary values are represented as numbers (no currency symbols, commas, or parentheses) and use negative signs for losses or negative cash flows.
    `;

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        summary: {
            type: Type.STRING,
            description: 'A concise, professional summary of the company\'s financial performance, position, and cash flows, highlighting significant changes and potential areas of concern.',
        },
        kpis: {
            type: Type.ARRAY,
            description: 'Key Performance Indicators.',
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    value2025: { type: Type.STRING },
                    value2024: { type: Type.STRING },
                    changePercentage: { type: Type.NUMBER },
                },
                required: ['name', 'value2025', 'value2024', 'changePercentage'],
            },
        },
        abn: {
            type: Type.STRING,
            description: 'The Australian Business Number (ABN) of the company, extracted from the documents.',
        },
        directorsDeclaration: {
            type: Type.OBJECT,
            properties: {
                directors: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            title: { type: Type.STRING },
                        },
                        required: ['name', 'title'],
                    }
                },
                date: { type: Type.STRING, description: "The date of the directors' declaration, e.g., '08 Jan 2025'." },
            },
            required: ['directors', 'date'],
        },
        incomeStatement: {
            type: Type.OBJECT,
            properties: {
                revenue: financialItemsArraySchema,
                expenses: financialItemsArraySchema,
                grossProfit: singleFinancialValueSchema,
                operatingIncome: singleFinancialValueSchema,
                netProfit: singleFinancialValueSchema,
            },
            required: ['revenue', 'expenses', 'grossProfit', 'operatingIncome', 'netProfit'],
        },
        balanceSheet: {
            type: Type.OBJECT,
            properties: {
                currentAssets: financialItemsArraySchema,
                nonCurrentAssets: financialItemsArraySchema,
                currentLiabilities: financialItemsArraySchema,
                nonCurrentLiabilities: financialItemsArraySchema,
                equity: financialItemsArraySchema,
                totalAssets: singleFinancialValueSchema,
                totalLiabilities: singleFinancialValueSchema,
                totalEquity: singleFinancialValueSchema,
            },
            required: ['currentAssets', 'nonCurrentAssets', 'currentLiabilities', 'nonCurrentLiabilities', 'equity', 'totalAssets', 'totalLiabilities', 'totalEquity'],
        },
        cashFlowStatement: {
            type: Type.OBJECT,
            properties: {
                operatingActivities: financialItemsArraySchema,
                investingActivities: financialItemsArraySchema,
                financingActivities: financialItemsArraySchema,
                netChangeInCash: singleFinancialValueSchema,
            },
            required: ['operatingActivities', 'investingActivities', 'financingActivities', 'netChangeInCash'],
        },
        notesToFinancialStatements: {
            type: Type.STRING,
            description: "The complete 'Notes to the Financial Statements' section, formatted as a single GitHub-flavored Markdown string. It must contain all required notes with proper hierarchical numbering (e.g., '**Note 1**', '**(a)**', '**(i)**')."
        }
    },
    required: ['summary', 'kpis', 'abn', 'directorsDeclaration', 'incomeStatement', 'balanceSheet', 'cashFlowStatement', 'notesToFinancialStatements'],
};

// Security: Environment-aware API error handling
export async function generateFinancialReport(file2024: File, file2025: File, config: ApiConfig): Promise<ReportData> {
  const prompt = KNOWLEDGE_BASE + getBasePrompt();

  if (config.provider === 'openrouter') {
    const jsonSchemaInstructions = `Your output MUST be a single, valid JSON object that strictly adheres to the structure I will describe. Do not include any text, markdown, or explanations before or after the JSON object.
    The JSON structure is as follows, please populate it completely:
    {
      "summary": "string",
      "kpis": [ { "name": "string", "value2025": "string", "value2024": "string", "changePercentage": "number" } ],
      "abn": "string",
      "directorsDeclaration": { "directors": [ { "name": "string", "title": "string" } ], "date": "string" },
      "incomeStatement": { 
          "revenue": [ { "item": "string", "amount2025": "number", "amount2024": "number", "noteRef": "number|null" } ], 
          "expenses": [ { "item": "string", "amount2025": "number", "amount2024": "number", "noteRef": "number|null" } ], 
          "grossProfit": { "amount2025": "number", "amount2024": "number" }, 
          "operatingIncome": { "amount2025": "number", "amount2024": "number" },
          "netProfit": { "amount2025": "number", "amount2024": "number" }
      },
      "balanceSheet": {
          "currentAssets": [ { "item": "string", "amount2025": "number", "amount2024": "number" } ],
          "nonCurrentAssets": [ { "item": "string", "amount2025": "number", "amount2024": "number" } ],
          "currentLiabilities": [ { "item": "string", "amount2025": "number", "amount2024": "number" } ],
          "nonCurrentLiabilities": [ { "item": "string", "amount2025": "number", "amount2024": "number" } ],
          "equity": [ { "item": "string", "amount2025": "number", "amount2024": "number" } ],
          "totalAssets": { "amount2025": "number", "amount2024": "number" },
          "totalLiabilities": { "amount2025": "number", "amount2024": "number" },
          "totalEquity": { "amount2025": "number", "amount2024": "number" }
      },
      "cashFlowStatement": {
          "operatingActivities": [ { "item": "string", "amount2025": "number", "amount2024": "number" } ],
          "investingActivities": [ { "item": "string", "amount2025": "number", "amount2024": "number" } ],
          "financingActivities": [ { "item": "string", "amount2025": "number", "amount2024": "number" } ],
          "netChangeInCash": { "amount2025": "number", "amount2024": "number" }
      },
      "notesToFinancialStatements": "string (A single markdown string containing all notes)"
    }
    Ensure all monetary values are numbers, removing currency symbols and using negative signs for losses.
    `;

    try {
        const part2024 = await fileToGenerativePart(file2024);
        const part2025 = await fileToGenerativePart(file2025);

        const apiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${config.apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: config.model,
                response_format: { "type": "json_object" },
                messages: [
                    {
                        "role": "user",
                        "content": [
                            { "type": "text", "text": prompt + jsonSchemaInstructions },
                            { 
                                "type": "image_url", 
                                "image_url": { "url": `data:${part2024.inlineData.mimeType};base64,${part2024.inlineData.data}` }
                            },
                            { 
                                "type": "image_url", 
                                "image_url": { "url": `data:${part2025.inlineData.mimeType};base64,${part2025.inlineData.data}` }
                            },
                        ]
                    }
                ]
            })
        });

        if (!apiResponse.ok) {
            throw new Error(`API request failed with status ${apiResponse.status}`);
        }

        const responseData = await apiResponse.json();
        const jsonText = responseData.choices[0].message.content;
        return JSON.parse(jsonText) as ReportData;

    } catch (error) {
        throw new Error(sanitizeError(error, 'OpenRouter API call'));
    }

  } else { // Gemini Provider
    const effectiveApiKey = config.apiKey || process.env.API_KEY as string;
    if (!effectiveApiKey) {
        throw new Error("Authentication failed. Please check your API configuration.");
    }
    const ai = new GoogleGenAI({ apiKey: effectiveApiKey });
    
    try {
        const part2024 = await fileToGenerativePart(file2024);
        const part2025 = await fileToGenerativePart(file2025);

        const response = await ai.models.generateContent({
            model: config.model,
            contents: { parts: [
                {text: prompt},
                part2024,
                part2025
            ]},
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });
        const jsonText = response.text.trim();
        const parsedData = JSON.parse(jsonText) as ReportData;
        return parsedData;
    } catch (error) {
        throw new Error(sanitizeError(error, 'Gemini API call'));
    }
  }
}

const formatCurrency = (value: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);

function generateErrorCorrectionInstructions(errors: VerificationResult, previousReport: ReportData): string {
    const failedChecks = errors.checks.filter(c => !c.passed);
    if (failedChecks.length === 0) {
        return "No errors found.";
    }

    const instructions = failedChecks.map(check => {
        const yearMatch = check.name.match(/\((2024|2025)\)/);
        const year = yearMatch ? yearMatch[1] : 'the relevant year';
        const yearSuffix = year === '2025' ? 'amount2025' : 'amount2024' as 'amount2025' | 'amount2024';

        if (check.name.includes('Balance Sheet Equation')) {
            const reportedAssets = previousReport.balanceSheet.totalAssets[yearSuffix];
            const reportedLiabilities = previousReport.balanceSheet.totalLiabilities[yearSuffix];
            const reportedEquity = previousReport.balanceSheet.totalEquity[yearSuffix];
            
            const calculatedSum = reportedLiabilities + reportedEquity;
            const discrepancy = reportedAssets - calculatedSum;

            return `- **${check.name}:** The balance sheet for ${year} does not balance. Assets of ${formatCurrency(reportedAssets)} do not equal Liabilities (${formatCurrency(reportedLiabilities)}) + Equity (${formatCurrency(reportedEquity)}). The discrepancy is ${formatCurrency(discrepancy)}.
  **Action:** You MUST correct this. The primary rule is **Assets = Liabilities + Equity**. First, recalculate all totals from their constituent parts.
  1.  Recalculate \`balanceSheet.totalAssets.${yearSuffix}\` by summing all items in \`balanceSheet.currentAssets\` and \`balanceSheet.nonCurrentAssets\` for that year.
  2.  Recalculate \`balanceSheet.totalLiabilities.${yearSuffix}\` by summing all items in \`balanceSheet.currentLiabilities\` and \`balanceSheet.nonCurrentLiabilities\` for that year.
  3.  After recalculating, if the equation is still unbalanced, you MUST adjust an item within the \`balanceSheet.equity\` array (typically 'Retained Earnings') to force the equation to balance. The new value for the adjusted equity item should be: (New Total Assets) - (New Total Liabilities) - (Sum of other equity items).
  4.  Finally, update \`balanceSheet.totalEquity.${yearSuffix}\` to be the sum of all items in the now-corrected \`equity\` array.`;
        }
        if (check.name.includes('Income Statement Integrity')) {
             const netProfit = previousReport.incomeStatement.netProfit[yearSuffix];
             const totalRevenue = previousReport.incomeStatement.revenue.reduce((sum, item) => sum + item[yearSuffix], 0);
             const totalExpenses = previousReport.incomeStatement.expenses.reduce((sum, item) => sum + item[yearSuffix], 0);
             const calculatedNetProfit = totalRevenue - totalExpenses;

            return `- **${check.name}:** The income statement for ${year} is incorrect. The reported 'netProfit' is ${formatCurrency(netProfit)}, but Revenue (${formatCurrency(totalRevenue)}) minus Expenses (${formatCurrency(totalExpenses)}) calculates to ${formatCurrency(calculatedNetProfit)}.
  **Action:** You MUST update the \`incomeStatement.netProfit.${yearSuffix}\` value to be the correct calculated value of ${calculatedNetProfit}.`;
        }
        if (check.name.includes('Cash Flow Integrity')) {
            const netChangeInCash = previousReport.cashFlowStatement.netChangeInCash[yearSuffix];
            const operating = previousReport.cashFlowStatement.operatingActivities.reduce((sum, item) => sum + item[yearSuffix], 0);
            const investing = previousReport.cashFlowStatement.investingActivities.reduce((sum, item) => sum + item[yearSuffix], 0);
            const financing = previousReport.cashFlowStatement.financingActivities.reduce((sum, item) => sum + item[yearSuffix], 0);
            const calculatedNetChange = operating + investing + financing;

            return `- **${check.name}:** The cash flow statement for ${year} is incorrect. The reported 'netChangeInCash' is ${formatCurrency(netChangeInCash)}, but the sum of all activities calculates to ${formatCurrency(calculatedNetChange)}.
  **Action:** You MUST update the \`cashFlowStatement.netChangeInCash.${yearSuffix}\` value to be the correct calculated value of ${calculatedNetChange}.`;
        }
        return `- **${check.name}:** An unspecified error occurred. Please review and correct. Discrepancy: ${formatCurrency(check.discrepancy)}.`;
    }).join('\n\n');

    return instructions;
}

export async function fixFinancialReport(
    previousReport: ReportData,
    verificationErrors: VerificationResult,
    config: ApiConfig
): Promise<ReportData> {
    const correctionInstructions = generateErrorCorrectionInstructions(verificationErrors, previousReport);
    const correctionPrompt = `
    You are a meticulous and expert senior accountant acting as a Certified Public Accountant (CPA).
    The financial report JSON you previously generated has failed a mathematical verification check. Your task is to correct it by precisely following the instructions below.

    **FINANCIAL REPORT TO BE CORRECTED:**
    \`\`\`json
    ${JSON.stringify(previousReport, null, 2)}
    \`\`\`

    **REQUIRED CORRECTIONS & ACTIONS:**
    ${correctionInstructions}

    **FINAL INSTRUCTIONS:**
    1.  You MUST implement all of the corrective "Actions" described above.
    2.  The output MUST be the complete, corrected JSON report, strictly adhering to the original schema.
    3.  Do NOT add any explanatory text, markdown, or code block syntax before or after the JSON.
    4.  Do NOT change any data (text, numbers, KPIs, notes, etc.) that is not directly part of a corrective action. Your goal is a minimal, targeted fix.

    Now, provide the corrected and complete JSON object.
    `;

    if (config.provider === 'openrouter') {
        const jsonSchemaInstructions = `Your output MUST be a single, valid JSON object that strictly adheres to the structure provided in the example report. Do not include any text, markdown, or explanations before or after the JSON object.`;
        try {
            const apiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${config.apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: config.model,
                    response_format: { "type": "json_object" },
                    messages: [{
                        "role": "user",
                        "content": correctionPrompt + jsonSchemaInstructions
                    }]
                })
            });

            if (!apiResponse.ok) {
                throw new Error(`Correction API request failed with status ${apiResponse.status}`);
            }

            const responseData = await apiResponse.json();
            const jsonText = responseData.choices[0].message.content;
            return JSON.parse(jsonText) as ReportData;

        } catch (error) {
            throw new Error(sanitizeError(error, 'OpenRouter correction API'));
        }
    } else { // Gemini Provider
        const effectiveApiKey = config.apiKey || process.env.API_KEY as string;
        if (!effectiveApiKey) throw new Error("Authentication failed for correction request.");
        const ai = new GoogleGenAI({ apiKey: effectiveApiKey });

        try {
            const response = await ai.models.generateContent({
                model: config.model,
                contents: { parts: [{ text: correctionPrompt }] },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                },
            });
            const jsonText = response.text.trim();
            return JSON.parse(jsonText) as ReportData;
        } catch (error) {
            throw new Error(sanitizeError(error, 'Gemini correction API'));
        }
    }
}

const createWavBlobFromPcm = (base64Pcm: string): Blob => {
    const decodeBase64 = (base64: string) => {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    };

    const pcmData = decodeBase64(base64Pcm);
    const sampleRate = 24000;
    const numChannels = 1;
    const bytesPerSample = 2; // 16-bit audio
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcmData.byteLength;
    const chunkSize = 36 + dataSize;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (view: DataView, offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, chunkSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bytesPerSample * 8, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    new Uint8Array(buffer, 44).set(new Uint8Array(pcmData));

    return new Blob([view], { type: 'audio/wav' });
};

// Security: Environment-aware audio generation error handling
export async function generateAudioSummary(summaryText: string): Promise<Blob> {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: { parts: [{ text: `Provide a professional, verbal summary of the following financial report analysis: ${summaryText}` }] },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' }, // A professional and clear voice
                    },
                },
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("Audio generation returned no data");
        }
        return createWavBlobFromPcm(base64Audio);
    } catch (error) {
        throw new Error(sanitizeError(error, 'audio summary generation'));
    }
}

export async function generateOpenRouterAudioSummary(summaryText: string, config: ApiConfig): Promise<Blob> {
    if (!config.apiKey) {
        throw new Error("Authentication required for audio generation");
    }
    if (!config.voiceModel) {
        throw new Error("Voice model configuration is required");
    }

    try {
        const response = await fetch("https://openrouter.ai/api/v1/audio/speech", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${config.apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: config.voiceModel,
                input: `Provide a professional, verbal summary of the following financial report analysis: ${summaryText}`
            }),
        });

        if (!response.ok) {
            throw new Error(`Audio generation failed with status ${response.status}`);
        }

        return await response.blob();

    } catch (error) {
        throw new Error(sanitizeError(error, 'OpenRouter audio generation'));
    }
}