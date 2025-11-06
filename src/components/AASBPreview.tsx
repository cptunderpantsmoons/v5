import React, { useState, useRef, useEffect } from 'react';
import type { ReportData, FinancialItem } from '../types';
import { sanitizeUserInput, isValidInput } from '../utils/sanitization';

interface AASBPreviewProps {
  data: ReportData;
  companyName: string;
  onGeneratePdf: () => void;
  isGeneratingPdf: boolean;
  isEditing: boolean;
  onDataChange?: (data: ReportData) => void;
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

const MarkdownRenderer: React.FC<{ 
  markdown: string, 
  isEditing: boolean,
  onChange?: (content: string) => void
}> = ({ markdown, isEditing, onChange }) => {
    const [content, setContent] = useState(markdown);
    const [isEditingSection, setIsEditingSection] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    
    useEffect(() => {
      setContent(markdown);
    }, [markdown]);

    const handleContentChange = (newContent: string) => {
      const sanitized = sanitizeUserInput(newContent);
      setContent(sanitized);
      if (onChange && isValidInput(sanitized, 10000)) {
        onChange(sanitized);
      }
    };

    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];

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
                                {headerCells.map((h, idx) => (
                                    <th key={idx} className="p-2 border border-gray-300 text-left font-semibold">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {tableRows.map((row, idx) => (
                                <tr key={idx} className="border-t border-gray-200">
                                    {row.map((cell, j) => {
                                        const isBold = cell.includes('**');
                                        const cleanCell = cell.replace(/\*\*/g, '');
                                        return <td key={j} className={`p-2 border border-gray-300 ${isBold ? 'font-bold' : ''}`}>{cleanCell}</td>
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
            elements.push(<h3 key={i} id={`note-${noteId}`} className="text-lg font-semibold text-gray-700 mt-6 mb-2">{title}</h3>);
        } else if (line.startsWith('**(')) {
            elements.push(<h4 key={i} className="text-md font-semibold text-gray-700 mt-4 mb-1">{line.replace(/\*\*/g, '')}</h4>);
        } else if (line.startsWith('**')) {
            elements.push(<h3 key={i} className="text-lg font-semibold text-gray-700 mt-6 mb-2">{line.replace(/\*\*/g, '')}</h3>);
        } else {
            elements.push(<p key={i} className="my-2">{line}</p>);
        }
    }

    const handleStartEditing = () => {
        if (isEditing) {
            setIsEditingSection(true);
            setTimeout(() => {
                textareaRef.current?.focus();
            }, 100);
        }
    };

    const handleStopEditing = () => {
        setIsEditingSection(false);
    };

    return (
        <div className="text-sm text-gray-600 space-y-2">
            {elements}
            {isEditing && (
                <div className="mt-4">
                    {!isEditingSection ? (
                        <button
                            onClick={handleStartEditing}
                            className="text-sky-600 hover:text-sky-800 text-xs underline"
                        >
                            Edit Notes Section
                        </button>
                    ) : (
                        <div className="space-y-2">
                            <textarea
                                ref={textareaRef}
                                value={content}
                                onChange={(e) => handleContentChange(e.target.value)}
                                className="w-full p-2 border border-sky-500 rounded focus:outline-none focus:ring-2 focus:ring-sky-500"
                                rows={10}
                                placeholder="Enter notes content..."
                                onBlur={handleStopEditing}
                                maxLength={10000}
                            />
                            <p className="text-xs text-gray-500">
                                Use Markdown formatting. Security: HTML and scripts are automatically removed.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const EditableField: React.FC<{
  value: string;
  onChange?: (value: string) => void;
  isEditing: boolean;
  className?: string;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
}> = ({ value, onChange, isEditing, className = '', placeholder = '', maxLength = 200, multiline = false }) => {
  const [isFocused, setIsFocused] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  const handleChange = (newValue: string) => {
    const sanitized = sanitizeUserInput(newValue);
    setDisplayValue(sanitized);
    if (onChange && isValidInput(sanitized, maxLength)) {
      onChange(sanitized);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  if (!isEditing) {
    return <span className={className}>{value}</span>;
  }

  if (multiline) {
    return (
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={displayValue}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={`${className} w-full min-h-[2rem] p-1 border border-sky-500 rounded focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none`}
          rows={isFocused ? 3 : 1}
          maxLength={maxLength}
        />
        {isFocused && (
          <p className="text-xs text-gray-500 mt-1">
            {displayValue.length}/{maxLength} characters
          </p>
        )}
      </div>
    );
  }

  return (
    <input
      type="text"
      value={displayValue}
      onChange={(e) => handleChange(e.target.value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={`${className} bg-transparent border-b border-dashed border-sky-500 focus:outline-none focus:border-sky-700`}
      maxLength={maxLength}
    />
  );
};

const PreviewTableRow: React.FC<{
  label: string; 
  val2025: string; 
  val2024: string; 
  isBold?: boolean; 
  noteRef?: number; 
  indent?: number, 
  isEditing: boolean,
  onLabelChange?: (value: string) => void,
  onValue2025Change?: (value: string) => void,
  onValue2024Change?: (value: string) => void
}> = ({ 
  label, val2025, val2024, isBold, noteRef, indent = 0, isEditing,
  onLabelChange, onValue2025Change, onValue2024Change
}) => {
    const labelStyle = { paddingLeft: `${indent * 1.5}rem` };
    const fontWeight = isBold ? 'font-bold' : 'font-normal';

    return (
        <tr className="border-b border-gray-200">
            <td className={`px-4 py-2 ${fontWeight}`} style={labelStyle}>
                <EditableField
                  value={label}
                  onChange={onLabelChange}
                  isEditing={isEditing}
                  className="min-w-[200px]"
                  placeholder="Enter label..."
                />
                {noteRef && <a href={`#note-${noteRef}`} className="text-gray-500 ml-1 font-normal hover:text-sky-600">({noteRef})</a>}
            </td>
            <td className={`px-4 py-2 text-right font-mono ${fontWeight}`}>
                <EditableField
                  value={val2025}
                  onChange={onValue2025Change}
                  isEditing={isEditing}
                  className="text-right"
                  placeholder="0"
                  maxLength={20}
                />
            </td>
            <td className={`px-4 py-2 text-right font-mono ${fontWeight}`}>
                <EditableField
                  value={val2024}
                  onChange={onValue2024Change}
                  isEditing={isEditing}
                  className="text-right"
                  placeholder="0"
                  maxLength={20}
                />
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

const AASBPreview: React.FC<AASBPreviewProps> = ({ 
  data, 
  companyName, 
  onGeneratePdf, 
  isGeneratingPdf, 
  isEditing,
  onDataChange
}) => {
    const { incomeStatement, balanceSheet } = data;
    const [localData, setLocalData] = useState(data);
    const [localCompanyName, setLocalCompanyName] = useState(companyName);
    const [localABN, setLocalABN] = useState(data.abn || '');
    
    useEffect(() => {
      setLocalData(data);
      setLocalCompanyName(companyName);
      setLocalABN(data.abn || '');
    }, [data, companyName]);

    const reItem = findItem(balanceSheet.equity, 'retained earnings');
    const re2024 = reItem?.amount2024 || 0;
    const re2025 = reItem?.amount2025 || 0;
    const re2023 = re2024 - (incomeStatement.netProfit?.amount2024 || 0);

    const instructionText = isEditing 
        ? "You are in edit mode. Click on any text or number to make changes. All input is sanitized for security. Click 'Finish Editing' to save."
        : "This is a preview of the final AASB-compliant report. To make corrections, use the 'Edit Report' button.";

    const handleDataChange = (updates: Partial<ReportData>) => {
      const newData = { ...localData, ...updates };
      setLocalData(newData);
      if (onDataChange) {
        onDataChange(newData);
      }
    };

    const handleCompanyNameChange = (name: string) => {
      setLocalCompanyName(name);
      // Update data if needed
    };

    const handleABNChange = (abn: string) => {
      const cleanABN = sanitizeUserInput(abn).replace(/[^0-9\s]/g, '');
      setLocalABN(cleanABN);
      handleDataChange({ abn: cleanABN });
    };

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
                <div className="text-lg">
                    <EditableField
                      value={localCompanyName}
                      onChange={handleCompanyNameChange}
                      isEditing={isEditing}
                      placeholder="Company Name"
                      maxLength={100}
                    />
                </div>
                {data.abn !== undefined && (
                    <div className="text-md text-gray-600">
                        ABN: 
                        <EditableField
                          value={localABN}
                          onChange={handleABNChange}
                          isEditing={isEditing}
                          placeholder="ABN"
                          maxLength={20}
                        />
                    </div>
                )}
                <p className="text-lg">For the Year Ended 30 June 2025</p>
            </div>

            {/* Income Statement Table */}
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
                    {incomeStatement.revenue.map((i, index) => (
                        <PreviewTableRow 
                          key={`revenue-${index}`}
                          label={i.item} 
                          val2025={formatCurrency(i.amount2025)} 
                          val2024={formatCurrency(i.amount2024)} 
                          noteRef={i.noteRef} 
                          isEditing={isEditing}
                          onLabelChange={(newLabel) => {
                            const newRevenue = [...incomeStatement.revenue];
                            newRevenue[index] = { ...i, item: newLabel };
                            handleDataChange({ 
                              incomeStatement: { 
                                ...incomeStatement, 
                                revenue: newRevenue 
                              } 
                            });
                          }}
                          onValue2025Change={(newValue) => {
                            const numValue = parseFloat(newValue.replace(/[^\d.-]/g, '')) || 0;
                            const newRevenue = [...incomeStatement.revenue];
                            newRevenue[index] = { ...i, amount2025: numValue };
                            handleDataChange({ 
                              incomeStatement: { 
                                ...incomeStatement, 
                                revenue: newRevenue 
                              } 
                            });
                          }}
                          onValue2024Change={(newValue) => {
                            const numValue = parseFloat(newValue.replace(/[^\d.-]/g, '')) || 0;
                            const newRevenue = [...incomeStatement.revenue];
                            newRevenue[index] = { ...i, amount2024: numValue };
                            handleDataChange({ 
                              incomeStatement: { 
                                ...incomeStatement, 
                                revenue: newRevenue 
                              } 
                            });
                          }}
                        />
                    ))}
                    <PreviewTableRow 
                      label="Total Income" 
                      val2025={formatCurrency(incomeStatement.revenue.reduce((s,i) => s + i.amount2025, 0))} 
                      val2024={formatCurrency(incomeStatement.revenue.reduce((s,i) => s + i.amount2024, 0))} 
                      isBold 
                      isEditing={isEditing}
                    />
                </tbody>
            </table>
            
            {/* Notes Section with Editable Content */}
            <Section title="Notes to the Financial Statements">
                <MarkdownRenderer 
                  markdown={data.notesToFinancialStatements} 
                  isEditing={isEditing}
                  onChange={(content) => handleDataChange({ notesToFinancialStatements: content })}
                />
            </Section>
            
            {/* Security Notice */}
            {isEditing && (
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2">🔒 Security Protection Active</h4>
                    <ul className="text-sm text-green-700 space-y-1">
                        <li>• All input is sanitized to prevent script injection</li>
                        <li>• HTML tags are automatically removed</li>
                        <li>• Only plain text content is allowed</li>
                        <li>• Character limits prevent buffer overflow attacks</li>
                    </ul>
                </div>
            )}
        </div>
    );
};

export default AASBPreview;