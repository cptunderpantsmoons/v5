import jsPDF from 'jspdf';
import type { ReportData, FinancialItem } from '../types';

// Helper to find an item in an array by a string match, case-insensitive
const findItem = (items: FinancialItem[], name: string): FinancialItem | undefined => {
    return items.find(item => item.item.toLowerCase().includes(name.toLowerCase()));
}

const parseMarkdownTableRow = (rowStr: string): string[] => {
    // Trim leading/trailing whitespace and pipe characters
    const cleaned = rowStr.trim().replace(/^\||\|$/g, '').trim();
    return cleaned.split('|').map(s => s.trim());
};


const drawMarkdownContent = (doc: jsPDF, markdown: string, startY: number, margin: number, contentWidth: number): number => {
    let yPos = startY;
    const lines = markdown.split('\n');
    const pageHeight = doc.internal.pageSize.height;
    const lineHeight = 10;
    const cellPadding = 2;

    const checkPageBreak = (spaceNeeded = 20) => {
        if (yPos > pageHeight - margin - spaceNeeded) {
            doc.addPage();
            yPos = margin;
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // --- Table Detection ---
        if (line.includes('|') && i + 1 < lines.length && lines[i+1].trim().match(/^\|? *(:?-+:? *\|?)+ *$/)) {
            const headerLine = line;
            const separatorLine = lines[i+1].trim();

            const headerCells = parseMarkdownTableRow(headerLine);
            const separatorCells = parseMarkdownTableRow(separatorLine);

            if (headerCells.length > 0 && separatorCells.every(c => c.match(/^:?-+:?$/))) {
                i++; // Consume separator line

                const tableRowsData: string[][] = [headerCells];
                
                // Consume table body rows
                let tableRowIndex = i + 1;
                while (tableRowIndex < lines.length) {
                    const rowLine = lines[tableRowIndex].trim();
                    if (rowLine.includes('|')) {
                        const rowCells = parseMarkdownTableRow(rowLine);
                        // Pad or truncate row to match header column count for consistency
                        while (rowCells.length < headerCells.length) rowCells.push('');
                        tableRowsData.push(rowCells.slice(0, headerCells.length));
                        tableRowIndex++;
                    } else {
                        break; // Line doesn't contain a pipe, table ends
                    }
                }

                i = tableRowIndex - 1; // Update the main loop counter

                // --- Draw the captured table ---
                const numColumns = headerCells.length;
                if (numColumns > 0) {
                    const colWidths = Array(numColumns).fill(contentWidth / numColumns);
                    
                    tableRowsData.forEach((row, rowIndex) => {
                        const isHeader = rowIndex === 0;
                        doc.setFontSize(9);
                        doc.setFont('helvetica', isHeader ? 'bold' : 'normal');

                        let maxLinesInRow = 0;
                        const splitRowContent = row.map((cell, colIndex) => {
                            const isBold = cell.includes('**');
                            const cleanCell = cell.replace(/\*\*/g, '');
                            const textLines = doc.splitTextToSize(cleanCell, colWidths[colIndex] - (cellPadding * 2));
                            maxLinesInRow = Math.max(maxLinesInRow, textLines.length);
                            return { textLines, isBold };
                        });

                        const rowHeight = (maxLinesInRow * lineHeight) + (cellPadding * 2);
                        checkPageBreak(rowHeight + 5);
                        
                        if (isHeader) {
                            doc.setFillColor(240, 240, 240);
                            doc.rect(margin, yPos, contentWidth, rowHeight, 'F');
                        }

                        splitRowContent.forEach(({ textLines, isBold }, colIndex) => {
                            const x = margin + colWidths.slice(0, colIndex).reduce((a, b) => a + b, 0) + cellPadding;
                            doc.setFont('helvetica', isBold ? 'bold' : 'normal');
                            doc.text(textLines, x, yPos + cellPadding + (lineHeight * 0.8));
                        });
                        
                        yPos += rowHeight;
                    });
                     yPos += 10; // Space after table
                }
                continue; // Continue for loop to next line after table
            }
        }
        
        // --- Non-table content ---
        if (line.length === 0) continue;
        checkPageBreak(25);
        if (line.match(/^\*\*(Note\s*\d+:.*)\*\*$/)) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            const title = line.replace(/\*\*/g, '');
            const splitText = doc.splitTextToSize(title, contentWidth);
            doc.text(splitText, margin, yPos);
            yPos += splitText.length * (lineHeight * 1.2) + 8;
        } else if (line.startsWith('**(')) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            const subtitle = line.replace(/\*\*/g, '');
            const splitText = doc.splitTextToSize(subtitle, contentWidth);
            doc.text(splitText, margin, yPos);
            yPos += splitText.length * (lineHeight * 1.2) + 5;
        } else {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            const splitText = doc.splitTextToSize(line, contentWidth);
            doc.text(splitText, margin, yPos);
            yPos += splitText.length * (lineHeight * 1.2) + 5;
        }
    }
    return yPos;
};


export const generateAASBPdf = (data: ReportData, companyName: string) => {
    const doc = new jsPDF('p', 'pt', 'a4');
    let yPos = 80; // Start y-position
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const margin = 50;
    const contentWidth = pageWidth - (margin * 2);
    const rightMargin = pageWidth - margin;
    const col2 = rightMargin - 100;
    const col3 = rightMargin;

    const tocEntries: { title: string; page: number; indent: number }[] = [];
    let pageCounter = 1;

    const addPage = () => {
        doc.addPage();
        pageCounter++;
        yPos = margin;
    };

    const checkPageBreak = (spaceNeeded = 40) => {
        if (yPos > pageHeight - margin - spaceNeeded) {
            addPage();
        }
    };

    const formatCurrency = (value: number) => {
        // Formats to (123,456) for negative numbers
        const formatted = new Intl.NumberFormat('en-US', {
            style: 'decimal',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(Math.abs(value));
        return value < 0 ? `(${formatted})` : formatted;
    };

    // --- 1. Cover Page ---
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('2025 Financial Statement Report', pageWidth / 2, 150, { align: 'center' });
    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text(companyName, pageWidth / 2, 180, { align: 'center' });
    if (data.abn) {
        doc.text(`ABN: ${data.abn}`, pageWidth / 2, 200, { align: 'center' });
    }
    doc.text('For the Year Ended 30 June 2025', pageWidth / 2, 220, { align: 'center' });

    addPage(); 
    const tocPage = pageCounter;

    addPage();

    // --- 2. Content Generation ---
    const recordTocEntry = (title: string, indent: number) => {
        tocEntries.push({ title, page: pageCounter, indent });
    };
    
    const drawSectionHeader = (title: string, tocTitle: string) => {
        checkPageBreak(50);
        recordTocEntry(tocTitle, 0);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(title, margin, yPos);
        yPos += 20;
    };
    
    const drawTableHeader = (col2Header: string, col3Header: string) => {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(col2Header, col2, yPos, { align: 'right' });
        doc.text(col3Header, col3, yPos, { align: 'right' });
        yPos += 15;
    };

    const drawTableRow = (label: string, val1: number | string, val2: number | string, isBold = false, noteRef?: number) => {
        checkPageBreak();
    
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        doc.text(label, margin, yPos);
    
        if (noteRef) {
            const labelWidth = doc.getTextWidth(label);
            doc.setFont('helvetica', 'normal');
            doc.text(`(${noteRef})`, margin + labelWidth + 4, yPos);
        }
    
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        doc.text(String(val1), col2, yPos, { align: 'right' });
        doc.text(String(val2), col3, yPos, { align: 'right' });
        yPos += 15;
    };

    // --- Income Statement ---
    drawSectionHeader("1. Income Statement", "1   Income Statement");
    drawTableHeader("2025", "2024");
    
    doc.setFont('helvetica', 'bold');
    doc.text("Income", margin, yPos);
    yPos += 15;
    data.incomeStatement.revenue.forEach(i => drawTableRow(i.item, formatCurrency(i.amount2025), formatCurrency(i.amount2024), false, i.noteRef));
    const totalIncome2025 = data.incomeStatement.revenue.reduce((s, i) => s + i.amount2025, 0);
    const totalIncome2024 = data.incomeStatement.revenue.reduce((s, i) => s + i.amount2024, 0);
    drawTableRow("Total Income", formatCurrency(totalIncome2025), formatCurrency(totalIncome2024), true);
    yPos += 10;
    
    doc.setFont('helvetica', 'bold');
    doc.text("Expenses", margin, yPos);
    yPos += 15;
    const nonTaxExpenses = data.incomeStatement.expenses.filter(i => !i.item.toLowerCase().includes('tax'));
    nonTaxExpenses.forEach(i => drawTableRow(i.item, formatCurrency(i.amount2025), formatCurrency(i.amount2024), false, i.noteRef));
    const totalExpenses2025 = nonTaxExpenses.reduce((s, i) => s + i.amount2025, 0);
    const totalExpenses2024 = nonTaxExpenses.reduce((s, i) => s + i.amount2024, 0);
    drawTableRow("Total Expenses", formatCurrency(totalExpenses2025), formatCurrency(totalExpenses2024), true);
    yPos += 10;

    const pbt2025 = totalIncome2025 - totalExpenses2025;
    const pbt2024 = totalIncome2024 - totalExpenses2024;
    drawTableRow("Profit/(Loss) Before Taxation", formatCurrency(pbt2025), formatCurrency(pbt2024), true);

    const taxItem = findItem(data.incomeStatement.expenses, 'tax');
    const tax2025 = taxItem?.amount2025 || 0;
    const tax2024 = taxItem?.amount2024 || 0;
    drawTableRow("Income Tax Expense/(Benefit)", formatCurrency(tax2025), formatCurrency(tax2024), false, taxItem?.noteRef);
    
    drawTableRow("Net Profit/(Loss) After Taxation", formatCurrency(data.incomeStatement.netProfit.amount2025), formatCurrency(data.incomeStatement.netProfit.amount2024), true, data.incomeStatement.netProfit.noteRef);

    // --- Appropriation Statement ---
    drawSectionHeader("2. Appropriation Statement", "2   Appropriation Statement");
    drawTableHeader("2025", "2024");
    const reItem = findItem(data.balanceSheet.equity, 'retained earnings');
    const re2024 = reItem?.amount2024 || 0;
    const re2025 = reItem?.amount2025 || 0;
    const re2023 = re2024 - data.incomeStatement.netProfit.amount2024; // Approximate for previous year
    drawTableRow("Retained Earnings At Start of Year", formatCurrency(re2024), formatCurrency(re2023));
    drawTableRow("Net Profit/(Loss) After Taxation", formatCurrency(data.incomeStatement.netProfit.amount2025), formatCurrency(data.incomeStatement.netProfit.amount2024), false, data.incomeStatement.netProfit.noteRef);
    drawTableRow("Retained Earnings After Appropriation", formatCurrency(re2025), formatCurrency(re2024), true, reItem?.noteRef);
    
    // --- Balance Sheet ---
    drawSectionHeader("3. Balance Sheet", "3   Balance Sheet");
    drawTableHeader("30 June 2025", "30 June 2024");
    doc.setFont('helvetica', 'bold');
    doc.text("Assets", margin, yPos);
    yPos += 15;
    doc.setFont('helvetica', 'normal');
    doc.text("Current Assets", margin, yPos);
    yPos += 15;
    data.balanceSheet.currentAssets.forEach(i => drawTableRow(`  ${i.item}`, formatCurrency(i.amount2025), formatCurrency(i.amount2024), false, i.noteRef));
    drawTableRow("Total Current Assets", formatCurrency(data.balanceSheet.currentAssets.reduce((s,i) => s + i.amount2025, 0)), formatCurrency(data.balanceSheet.currentAssets.reduce((s,i) => s + i.amount2024, 0)), true);
    yPos += 10;
    doc.text("Non-Current Assets", margin, yPos);
    yPos += 15;
    data.balanceSheet.nonCurrentAssets.forEach(i => drawTableRow(`  ${i.item}`, formatCurrency(i.amount2025), formatCurrency(i.amount2024), false, i.noteRef));
    drawTableRow("Total Non-Current Assets", formatCurrency(data.balanceSheet.nonCurrentAssets.reduce((s,i) => s + i.amount2025, 0)), formatCurrency(data.balanceSheet.nonCurrentAssets.reduce((s,i) => s + i.amount2024, 0)), true);
    yPos += 10;
    drawTableRow("Total Assets", formatCurrency(data.balanceSheet.totalAssets.amount2025), formatCurrency(data.balanceSheet.totalAssets.amount2024), true, data.balanceSheet.totalAssets.noteRef);
    yPos += 20;

    doc.setFont('helvetica', 'bold');
    doc.text("Liabilities", margin, yPos);
    yPos += 15;
    doc.setFont('helvetica', 'normal');
    doc.text("Current Liabilities", margin, yPos);
    yPos += 15;
    data.balanceSheet.currentLiabilities.forEach(i => drawTableRow(`  ${i.item}`, formatCurrency(i.amount2025), formatCurrency(i.amount2024), false, i.noteRef));
    drawTableRow("Total Current Liabilities", formatCurrency(data.balanceSheet.currentLiabilities.reduce((s,i) => s + i.amount2025, 0)), formatCurrency(data.balanceSheet.currentLiabilities.reduce((s,i) => s + i.amount2024, 0)), true);
    yPos += 10;
    doc.text("Non-Current Liabilities", margin, yPos);
    yPos += 15;
    data.balanceSheet.nonCurrentLiabilities.forEach(i => drawTableRow(`  ${i.item}`, formatCurrency(i.amount2025), formatCurrency(i.amount2024), false, i.noteRef));
    drawTableRow("Total Non-Current Liabilities", formatCurrency(data.balanceSheet.nonCurrentLiabilities.reduce((s,i) => s + i.amount2025, 0)), formatCurrency(data.balanceSheet.nonCurrentLiabilities.reduce((s,i) => s + i.amount2024, 0)), true);
    yPos += 10;
    drawTableRow("Total Liabilities", formatCurrency(data.balanceSheet.totalLiabilities.amount2025), formatCurrency(data.balanceSheet.totalLiabilities.amount2024), true, data.balanceSheet.totalLiabilities.noteRef);
    yPos += 10;
    
    const netAssets2025 = data.balanceSheet.totalAssets.amount2025 - data.balanceSheet.totalLiabilities.amount2025;
    const netAssets2024 = data.balanceSheet.totalAssets.amount2024 - data.balanceSheet.totalLiabilities.amount2024;
    drawTableRow("Net Assets", formatCurrency(netAssets2025), formatCurrency(netAssets2024), true, data.balanceSheet.totalEquity.noteRef);
    yPos += 20;

    doc.setFont('helvetica', 'bold');
    doc.text("Equity", margin, yPos);
    yPos += 15;
    data.balanceSheet.equity.forEach(i => drawTableRow(`  ${i.item}`, formatCurrency(i.amount2025), formatCurrency(i.amount2024), false, i.noteRef));
    drawTableRow("Total Equity", formatCurrency(data.balanceSheet.totalEquity.amount2025), formatCurrency(data.balanceSheet.totalEquity.amount2024), true, data.balanceSheet.totalEquity.noteRef);

    // --- Notes to the Financial Statements ---
    addPage();
    drawSectionHeader("Notes to the Financial Statements", "4   Notes to the Financial Statements");
    yPos = drawMarkdownContent(doc, data.notesToFinancialStatements, yPos, margin, contentWidth);

    // --- Directors' Declaration ---
    addPage();
    drawSectionHeader("Directors' Declaration", "Directors' Declaration");
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const declarationText = [
        "The directors have determined that the Company is not a reporting entity and that this special purpose financial report should be prepared in accordance with the accounting policies outlined in Note 1 to the financial statements. The directors of the Company declare that:",
        "1. The financial statements and notes present fairly the Company's financial position as at 30 June 2025 and its performance for the year ended on that date in accordance with the accounting policies described in Notes 1 to 3 to the financial statements; and",
        "2. In the directors' opinion there are reasonable grounds to believe that the Company will be able to pay its debts as and when they become due and payable.",
        "This declaration is made in accordance with a resolution of the Board of Directors."
    ];
    declarationText.forEach(line => {
         const splitText = doc.splitTextToSize(line, contentWidth);
         doc.text(splitText, margin, yPos);
         yPos += (splitText.length * 12) + 10;
         checkPageBreak();
    });
    yPos += 50;

    if (data.directorsDeclaration?.directors) {
        data.directorsDeclaration.directors.forEach(dir => {
            checkPageBreak();
            doc.text(`${dir.title}: ${dir.name}`, margin, yPos);
            yPos += 30;
        });
    }
    if (data.directorsDeclaration?.date) {
        checkPageBreak();
        doc.text(`Signed date: ${data.directorsDeclaration.date}`, margin, yPos);
    }

    // --- 3. Go back and draw the TOC ---
    doc.setPage(tocPage);
    yPos = margin;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Contents', pageWidth / 2, yPos, { align: 'center' });
    yPos += 30;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const dotWidth = doc.getTextWidth('.');
    const uniqueTocEntries = [...new Map(tocEntries.map(item => [item['title'], item])).values()];
    
    uniqueTocEntries.forEach(entry => {
        const xOffset = margin + (entry.indent * 20);
        doc.text(entry.title, xOffset, yPos);
        const textWidth = doc.getTextWidth(entry.title);
        const pageNumStr = String(entry.page);
        const pageNumWidth = doc.getTextWidth(pageNumStr);
        
        let availableWidth = rightMargin - xOffset - textWidth - pageNumWidth - 5;
        let dots = '.'.repeat(Math.max(0, Math.floor(availableWidth / dotWidth)));
        
        doc.text(dots, xOffset + textWidth + 2, yPos, { baseline: 'bottom' });
        doc.text(pageNumStr, rightMargin, yPos, { align: 'right' });
        yPos += 20;
    });

    // --- 4. Add Page Numbers to all pages ---
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 20, { align: 'right' });
    }

    doc.save('AASB_Financial_Report_2025.pdf');
};