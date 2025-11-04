import React from 'react';
import type { ReportData, FinancialItem } from '../types';

interface AASBPreviewProps {
  data: ReportData;
  companyName: string;
  onGeneratePdf: () => void;
  isGeneratingPdf: boolean;
  isEditing: boolean;
}

const findItem = (items: FinancialItem[], name: string): FinancialItem | undefined => {
    if (!items) return undefined;
    return items.find(item => item.item.toLowerCase().includes(name.toLowerCase()));
}

const formatCurrency = (value: number | undefined) => {
    if (value === undefined || value === null) return '-';
    const formatted = new Intl.NumberFormat('en-US', {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(Math.abs(value));
    return value < 0 ? `(${formatted})` : formatted;
};

const parseMarkdownTableRow = (rowStr: string): string[] => {
    // Trim leading/trailing whitespace and pipe characters
    const cleaned = rowStr.trim().replace(/^\||\|$/g, '').trim();
    return cleaned.split('|').map(s => s.trim());
};

const MarkdownRenderer: React.FC<{ markdown: string, isEditing: boolean }> = ({ markdown, isEditing }) => {
    const lines = markdown.split('\n');
    const elements: React.ReactNode[] = [];
    const editableClass = isEditing ? 'p-1 rounded outline-dashed outline-1 outline-sky-500' : '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // --- Table Detection ---
        if (line.includes('|') && i + 1 < lines.length && lines[i+1].trim().match(/^\|? *(:?-+:? *\|?)+ *$/)) {
            const headerLine = line;
            const separatorLine = lines[i+1].trim();
            const headerCells = parseMarkdownTableRow(headerLine);
            const separatorCells = parseMarkdownTableRow(separatorLine);

            if (headerCells.length > 0 && separatorCells.every(c => c.match(/^:?-+:?$/))) {
                i++; // consume separator line

                const tableRows: string[][] = [];
                let tableRowIndex = i + 1;
                while (tableRowIndex < lines.length) {
                    const rowLine = lines[tableRowIndex].trim();
                    if (rowLine.includes('|')) {
                        const rowCells = parseMarkdownTableRow(rowLine);
                        while (rowCells.length < headerCells.length) rowCells.push('');
                        tableRows.push(rowCells.slice(0, headerCells.length));
                        tableRowIndex++;
                    } else {
                        break;
                    }
                }

                i = tableRowIndex - 1;

                elements.push(
                    <table key={`table-${i}`} className="w-full text-sm my-4 border-collapse border border-gray-300">
                        <thead className="bg-gray-100">
                            <tr>
                                {headerCells.map((h, idx) => <th key={idx} className="p-2 border border-gray-300 text-left font-semibold"><span contentEditable={isEditing} suppressContentEditableWarning={true} className={editableClass}>{h}</span></th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {tableRows.map((row, idx) => (
                                <tr key={idx} className="border-t border-gray-200">
                                    {row.map((cell, j) => {
                                        const isBold = cell.includes('**');
                                        const cleanCell = cell.replace(/\*\*/g, '');
                                        return <td key={j} className={`p-2 border border-gray-300 ${isBold ? 'font-bold' : ''}`}><span contentEditable={isEditing} suppressContentEditableWarning={true} className={editableClass}>{cleanCell}</span></td>
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                );
                continue;
            }
        }
        
        // --- Non-table content rendering ---
        if (line.length === 0) continue;
        const noteMatch = line.match(/^\*\*(Note\s*(\d+):.*)\*\*$/);
        if (noteMatch) {
            const [, title, noteId] = noteMatch;
            elements.push(<h3 key={i} id={`note-${noteId}`} className="text-lg font-semibold text-gray-700 mt-6 mb-2"><span contentEditable={isEditing} suppressContentEditableWarning={true} className={editableClass}>{title}</span></h3>);
        } else if (line.startsWith('**(')) {
            elements.push(<h4 key={i} className="text-md font-semibold text-gray-700 mt-4 mb-1"><span contentEditable={isEditing} suppressContentEditableWarning={true} className={editableClass}>{line.replace(/\*\*/g, '')}</span></h4>);
        } else if (line.startsWith('**')) {
            elements.push(<h3 key={i} className="text-lg font-semibold text-gray-700 mt-6 mb-2"><span contentEditable={isEditing} suppressContentEditableWarning={true} className={editableClass}>{line.replace(/\*\*/g, '')}</span></h3>);
        } else {
            elements.push(<p key={i} className="my-2"><span contentEditable={isEditing} suppressContentEditableWarning={true} className={editableClass}>{line}</span></p>);
        }
    }

    return <div className="text-sm text-gray-600 space-y-2">{elements}</div>;
};

const PreviewTableRow: React.FC<{label: string; val2025: string; val2024: string; isBold?: boolean; noteRef?: number; indent?: number, isEditing: boolean}> = ({ label, val2025, val2024, isBold, noteRef, indent = 0, isEditing }) => {
    const labelStyle = { paddingLeft: `${indent * 1.5}rem` };
    const fontWeight = isBold ? 'font-bold' : 'font-normal';
    const editableClass = isEditing ? 'p-1 rounded outline-dashed outline-1 outline-sky-500' : '';

    return (
        <tr className="border-b border-gray-200">
            <td className={`px-4 py-2 ${fontWeight}`} style={labelStyle}>
                <span contentEditable={isEditing} suppressContentEditableWarning={true} className={editableClass}>{label}</span>
                {noteRef && <a href={`#note-${noteRef}`} className="text-gray-500 ml-1 font-normal hover:text-sky-600">({noteRef})</a>}
            </td>
            <td className={`px-4 py-2 text-right font-mono ${fontWeight}`}>
                 <span contentEditable={isEditing} suppressContentEditableWarning={true} className={editableClass}>{val2025}</span>
            </td>
            <td className={`px-4 py-2 text-right font-mono ${fontWeight}`}>
                <span contentEditable={isEditing} suppressContentEditableWarning={true} className={editableClass}>{val2024}</span>
            </td>
        </tr>
    );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-800 border-b-2 border-gray-300 pb-2 mb-4">{title}</h2>
        {children}
    </div>
);

const AASBPreview: React.FC<AASBPreviewProps> = ({ data, companyName, onGeneratePdf, isGeneratingPdf, isEditing }) => {
    const { incomeStatement, balanceSheet } = data;
    
    const reItem = findItem(balanceSheet.equity, 'retained earnings');
    const re2024 = reItem?.amount2024 || 0;
    const re2025 = reItem?.amount2025 || 0;
    const re2023 = re2024 - (incomeStatement.netProfit?.amount2024 || 0);

    const instructionText = isEditing 
        ? "You are in edit mode. Click on any text or number to make changes. Click 'Finish Editing' to save."
        : "This is a preview of the final AASB-compliant report. To make corrections, use the 'Edit Report' button.";

    const editableClass = isEditing ? 'p-1 rounded outline-dashed outline-1 outline-sky-500' : '';

    return (
        <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-sky-50 border-l-4 border-sky-500 p-4 rounded-md">
                 <div>
                    <h3 className="font-bold text-sky-800">AASB Report Preview</h3>
                    <p className="text-sm text-sky-700 mt-1">
                        {instructionText}
                    </p>
                </div>
                <button
                    onClick={onGeneratePdf}
                    disabled={isGeneratingPdf}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2 disabled:bg-indigo-300 disabled:cursor-not-allowed"
                >
                    {isGeneratingPdf ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Generating...
                        </>
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                            </svg>
                            Download AASB PDF (2025)
                        </>
                    )}
                </button>
            </div>

            <div className="text-center mb-12">
                <h1 className="text-2xl font-bold">2025 Financial Statement Report</h1>
                <p className="text-lg"><span contentEditable={isEditing} suppressContentEditableWarning={true} className={editableClass}>{companyName}</span></p>
                {data.abn && <p className="text-md text-gray-600">ABN: <span contentEditable={isEditing} suppressContentEditableWarning={true} className={editableClass}>{data.abn}</span></p>}
                <p className="text-lg">For the Year Ended 30 June 2025</p>
            </div>

            <table className="w-full text-sm mb-8">
                 <thead className="text-left bg-gray-100">
                    <tr>
                        <th className="px-4 py-2 font-semibold">1. Income Statement</th>
                        <th className="px-4 py-2 font-semibold text-right" style={{width: '120px'}}>2025</th>
                        <th className="px-4 py-2 font-semibold text-right" style={{width: '120px'}}>2024</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td colSpan={3} className="pt-2 px-4 font-bold">Income</td></tr>
                    {incomeStatement.revenue.map(i => <PreviewTableRow key={i.item} label={i.item} val2025={formatCurrency(i.amount2025)} val2024={formatCurrency(i.amount2024)} noteRef={i.noteRef} isEditing={isEditing} />)}
                    <PreviewTableRow label="Total Income" val2025={formatCurrency(incomeStatement.revenue.reduce((s,i) => s + i.amount2025, 0))} val2024={formatCurrency(incomeStatement.revenue.reduce((s,i) => s + i.amount2024, 0))} isBold isEditing={isEditing} />

                    <tr><td colSpan={3} className="pt-4 px-4 font-bold">Expenses</td></tr>
                    {incomeStatement.expenses.filter(i => !i.item.toLowerCase().includes('tax')).map(i => <PreviewTableRow key={i.item} label={i.item} val2025={formatCurrency(i.amount2025)} val2024={formatCurrency(i.amount2024)} noteRef={i.noteRef} isEditing={isEditing} />)}
                    <PreviewTableRow label="Total Expenses" val2025={formatCurrency(incomeStatement.expenses.filter(i => !i.item.toLowerCase().includes('tax')).reduce((s,i) => s + i.amount2025, 0))} val2024={formatCurrency(incomeStatement.expenses.filter(i => !i.item.toLowerCase().includes('tax')).reduce((s,i) => s + i.amount2024, 0))} isBold isEditing={isEditing} />

                    <tr className="border-t-2 border-gray-300"><td colSpan={3} className="py-2"></td></tr>
                    <PreviewTableRow label="Profit/(Loss) Before Taxation" val2025={formatCurrency(incomeStatement.netProfit.amount2025 + (findItem(incomeStatement.expenses, 'tax')?.amount2025 || 0))} val2024={formatCurrency(incomeStatement.netProfit.amount2024 + (findItem(incomeStatement.expenses, 'tax')?.amount2024 || 0))} isBold isEditing={isEditing} />
                    <PreviewTableRow label="Income Tax Expense/(Benefit)" val2025={formatCurrency(findItem(incomeStatement.expenses, 'tax')?.amount2025)} val2024={formatCurrency(findItem(incomeStatement.expenses, 'tax')?.amount2024)} noteRef={findItem(incomeStatement.expenses, 'tax')?.noteRef} isEditing={isEditing} />
                    <PreviewTableRow label="Net Profit/(Loss) After Taxation" val2025={formatCurrency(incomeStatement.netProfit.amount2025)} val2024={formatCurrency(incomeStatement.netProfit.amount2024)} isBold noteRef={incomeStatement.netProfit.noteRef} isEditing={isEditing} />
                </tbody>
            </table>
            
             <table className="w-full text-sm mb-8">
                 <thead className="text-left bg-gray-100">
                    <tr>
                        <th className="px-4 py-2 font-semibold">2. Appropriation Statement</th>
                        <th className="px-4 py-2 font-semibold text-right" style={{width: '120px'}}>2025</th>
                        <th className="px-4 py-2 font-semibold text-right" style={{width: '120px'}}>2024</th>
                    </tr>
                </thead>
                <tbody>
                    <PreviewTableRow label="Retained Earnings At Start of Year" val2025={formatCurrency(re2024)} val2024={formatCurrency(re2023)} isEditing={isEditing} />
                    <PreviewTableRow label="Net Profit/(Loss) After Taxation" val2025={formatCurrency(incomeStatement.netProfit.amount2025)} val2024={formatCurrency(incomeStatement.netProfit.amount2024)} noteRef={incomeStatement.netProfit.noteRef} isEditing={isEditing} />
                    <PreviewTableRow label="Retained Earnings After Appropriation" val2025={formatCurrency(re2025)} val2024={formatCurrency(re2024)} isBold noteRef={reItem?.noteRef} isEditing={isEditing} />
                </tbody>
            </table>
            
            <table className="w-full text-sm mb-8">
                 <thead className="text-left bg-gray-100">
                    <tr>
                        <th className="px-4 py-2 font-semibold">3. Balance Sheet</th>
                        <th className="px-4 py-2 font-semibold text-right" style={{width: '120px'}}>30 June 2025</th>
                        <th className="px-4 py-2 font-semibold text-right" style={{width: '120px'}}>30 June 2024</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td colSpan={3} className="pt-2 px-4 font-bold">Assets</td></tr>
                    <tr><td colSpan={3} className="pt-2 px-4 font-semibold">Current Assets</td></tr>
                    {balanceSheet.currentAssets.map(i => <PreviewTableRow key={i.item} label={i.item} val2025={formatCurrency(i.amount2025)} val2024={formatCurrency(i.amount2024)} indent={1} noteRef={i.noteRef} isEditing={isEditing} />)}
                    <PreviewTableRow label="Total Current Assets" val2025={formatCurrency(balanceSheet.currentAssets.reduce((s,i) => s + i.amount2025, 0))} val2024={formatCurrency(balanceSheet.currentAssets.reduce((s,i) => s + i.amount2024, 0))} isBold isEditing={isEditing} />
                    
                    <tr><td colSpan={3} className="pt-4 px-4 font-semibold">Non-Current Assets</td></tr>
                    {balanceSheet.nonCurrentAssets.map(i => <PreviewTableRow key={i.item} label={i.item} val2025={formatCurrency(i.amount2025)} val2024={formatCurrency(i.amount2024)} indent={1} noteRef={i.noteRef} isEditing={isEditing} />)}
                    <PreviewTableRow label="Total Non-Current Assets" val2025={formatCurrency(balanceSheet.nonCurrentAssets.reduce((s,i) => s + i.amount2025, 0))} val2024={formatCurrency(balanceSheet.nonCurrentAssets.reduce((s,i) => s + i.amount2024, 0))} isBold isEditing={isEditing} />
                    <PreviewTableRow label="Total Assets" val2025={formatCurrency(balanceSheet.totalAssets.amount2025)} val2024={formatCurrency(balanceSheet.totalAssets.amount2024)} isBold noteRef={balanceSheet.totalAssets.noteRef} isEditing={isEditing} />

                    <tr><td colSpan={3} className="pt-4 px-4 font-bold">Liabilities</td></tr>
                    <tr><td colSpan={3} className="pt-2 px-4 font-semibold">Current Liabilities</td></tr>
                    {balanceSheet.currentLiabilities.map(i => <PreviewTableRow key={i.item} label={i.item} val2025={formatCurrency(i.amount2025)} val2024={formatCurrency(i.amount2024)} indent={1} noteRef={i.noteRef} isEditing={isEditing} />)}
                    <PreviewTableRow label="Total Current Liabilities" val2025={formatCurrency(balanceSheet.currentLiabilities.reduce((s,i) => s + i.amount2025, 0))} val2024={formatCurrency(balanceSheet.currentLiabilities.reduce((s,i) => s + i.amount2024, 0))} isBold isEditing={isEditing} />
                    
                     <tr><td colSpan={3} className="pt-4 px-4 font-semibold">Non-Current Liabilities</td></tr>
                    {balanceSheet.nonCurrentLiabilities.map(i => <PreviewTableRow key={i.item} label={i.item} val2025={formatCurrency(i.amount2025)} val2024={formatCurrency(i.amount2024)} indent={1} noteRef={i.noteRef} isEditing={isEditing} />)}
                    <PreviewTableRow label="Total Non-Current Liabilities" val2025={formatCurrency(balanceSheet.nonCurrentLiabilities.reduce((s,i) => s + i.amount2025, 0))} val2024={formatCurrency(balanceSheet.nonCurrentLiabilities.reduce((s,i) => s + i.amount2024, 0))} isBold isEditing={isEditing} />
                    <PreviewTableRow label="Total Liabilities" val2025={formatCurrency(balanceSheet.totalLiabilities.amount2025)} val2024={formatCurrency(balanceSheet.totalLiabilities.amount2024)} isBold noteRef={balanceSheet.totalLiabilities.noteRef} isEditing={isEditing} />
                    <PreviewTableRow label="Net Assets" val2025={formatCurrency(balanceSheet.totalAssets.amount2025 - balanceSheet.totalLiabilities.amount2025)} val2024={formatCurrency(balanceSheet.totalAssets.amount2024 - balanceSheet.totalLiabilities.amount2024)} isBold noteRef={balanceSheet.totalEquity.noteRef} isEditing={isEditing} />

                    <tr><td colSpan={3} className="pt-4 px-4 font-bold">Equity</td></tr>
                    {balanceSheet.equity.map(i => <PreviewTableRow key={i.item} label={i.item} val2025={formatCurrency(i.amount2025)} val2024={formatCurrency(i.amount2024)} indent={1} noteRef={i.noteRef} isEditing={isEditing} />)}
                    <PreviewTableRow label="Total Equity" val2025={formatCurrency(balanceSheet.totalEquity.amount2025)} val2024={formatCurrency(balanceSheet.totalEquity.amount2024)} isBold noteRef={balanceSheet.totalEquity.noteRef} isEditing={isEditing} />
                </tbody>
            </table>
            
            <Section title="Notes to the Financial Statements">
                <MarkdownRenderer markdown={data.notesToFinancialStatements} isEditing={isEditing} />
            </Section>
            
            <Section title="Directors' Declaration">
                <div contentEditable={isEditing} suppressContentEditableWarning={true}>
                    <div className={`text-sm space-y-4 text-gray-700 ${isEditing ? 'p-2 rounded outline-dashed outline-1 outline-sky-500' : ''}`}>
                        <p>The directors have determined that the Company is not a reporting entity and that this special purpose financial report should be prepared in accordance with the accounting policies outlined in Note 1 to the financial statements. The directors of the Company declare that:</p>
                        <ol className="list-decimal pl-6 space-y-2">
                            <li>The financial statements and notes present fairly the Company's financial position as at 30 June 2025 and its performance for the year ended on that date in accordance with the accounting policies described in Note 1 to the financial statements; and</li>
                            <li>In the directors' opinion there are reasonable grounds to believe that the Company will be able to pay its debts as and when they become due and payable.</li>
                        </ol>
                        <p>This declaration is made in accordance with a resolution of the Board of Directors.</p>
                        <div className="pt-12 space-y-6">
                            {data.directorsDeclaration?.directors.map(dir => (
                                 <p key={dir.name}>{dir.title}: {dir.name}</p>
                            ))}
                            {data.directorsDeclaration?.date && <p>Signed date: {data.directorsDeclaration.date}</p>}
                        </div>
                    </div>
                </div>
            </Section>
        </div>
    );
};

export default AASBPreview;