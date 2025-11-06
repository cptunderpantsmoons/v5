import React, { useState, useRef, useEffect } from 'react';
import type { FinancialItem } from '../types';
import { sanitizeUserInput, validateNumericInput, isValidInput } from '../utils/sanitization';

interface ComparisonTableProps {
  items: FinancialItem[];
  isEditing: boolean;
  onItemsChange?: (items: FinancialItem[]) => void;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

const ComparisonTable: React.FC<ComparisonTableProps> = ({ items, isEditing, onItemsChange }) => {
  const [editMode, setEditMode] = useState(false);
  const [localItems, setLocalItems] = useState<FinancialItem[]>(items);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const editableClass = isEditing ? 'border border-sky-500 rounded p-1 focus:outline-none focus:ring-2 focus:ring-sky-500' : '';
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  useEffect(() => {
    if (textareaRef.current && focusedField) {
      textareaRef.current.focus();
    }
  }, [focusedField]);

  const handleItemEdit = (itemIndex: number, field: 'item' | 'amount2025' | 'amount2024', value: string) => {
    // Sanitize input based on field type
    let sanitizedValue = value;
    
    if (field === 'amount2025' || field === 'amount2024') {
      sanitizedValue = validateNumericInput(value);
    } else {
      sanitizedValue = sanitizeUserInput(value);
    }

    setEditedValues(prev => ({
      ...prev,
      [`${itemIndex}-${field}`]: sanitizedValue
    }));

    if (onItemsChange) {
      const newItems = [...localItems];
      if (field === 'amount2025' || field === 'amount2024') {
        // Parse numeric value, default to 0 if empty or invalid
        const numValue = parseFloat(sanitizedValue.replace(/[,$\s]/g, '')) || 0;
        newItems[itemIndex][field] = numValue;
      } else {
        newItems[itemIndex][field] = sanitizedValue;
      }
      onItemsChange(newItems);
    }
  };

  const getDisplayValue = (itemIndex: number, field: 'item' | 'amount2025' | 'amount2024', originalValue: string | number) => {
    const editKey = `${itemIndex}-${field}`;
    return editedValues[editKey] !== undefined ? editedValues[editKey] : 
           (typeof originalValue === 'number' ? formatCurrency(originalValue) : originalValue);
  };

  const handleFocus = (fieldId: string) => {
    if (isEditing) {
      setFocusedField(fieldId);
      // Convert displayed currency to raw value for editing
      const editKey = fieldId;
      if (editedValues[editKey]) {
        const rawValue = editedValues[editKey].replace(/[$,\s]/g, '');
        setEditedValues(prev => ({
          ...prev,
          [editKey]: rawValue
        }));
      }
    }
  };

  const handleBlur = (fieldId: string) => {
    setFocusedField(null);
    // Reformat currency values on blur
    const fieldParts = fieldId.split('-');
    const fieldType = fieldParts[1] as 'amount2025' | 'amount2024';
    
    if ((fieldType === 'amount2025' || fieldType === 'amount2024') && editedValues[fieldId]) {
      const numValue = parseFloat(editedValues[fieldId]) || 0;
      const formatted = formatCurrency(numValue);
      setEditedValues(prev => ({
        ...prev,
        [fieldId]: formatted
      }));
    }
  };
  
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-gray-600">
        <thead className="text-xs text-gray-500 uppercase bg-gray-100">
          <tr>
            <th scope="col" className="px-6 py-3">
              Item
            </th>
            <th scope="col" className="px-6 py-3 text-right">
              2025
            </th>
            <th scope="col" className="px-6 py-3 text-right">
              2024
            </th>
          </tr>
        </thead>
        <tbody>
          {localItems.map((item, index) => (
            <tr key={`${item.item}-${index}`} className="border-b border-gray-200 hover:bg-gray-50">
              <th scope="row" className="px-6 py-4 font-medium text-gray-800 whitespace-nowrap">
                {isEditing ? (
                  <div>
                    <textarea
                      ref={textareaRef}
                      value={getDisplayValue(index, 'item', item.item)}
                      onChange={(e) => handleItemEdit(index, 'item', e.target.value)}
                      className={`${editableClass} w-full min-h-[2rem] resize-none bg-transparent`}
                      rows={1}
                      placeholder="Enter item name..."
                      onFocus={() => handleFocus(`${index}-item`)}
                      onBlur={() => handleBlur(`${index}-item`)}
                      maxLength={200}
                    />
                    {item.noteRef && (
                      <a href={`#note-${item.noteRef}`} className="ml-2 text-gray-500 hover:text-sky-600 no-underline" title={`Reference to Note ${item.noteRef}`}>
                        <sup className="text-xs font-mono py-0.5 px-1.5 rounded-sm bg-gray-200">({item.noteRef})</sup>
                      </a>
                    )}
                  </div>
                ) : (
                  <div>
                    {item.item}
                    {item.noteRef && (
                      <a href={`#note-${item.noteRef}`} className="ml-2 text-gray-500 hover:text-sky-600 no-underline" title={`Reference to Note ${item.noteRef}`}>
                        <sup className="text-xs font-mono py-0.5 px-1.5 rounded-sm bg-gray-200">({item.noteRef})</sup>
                      </a>
                    )}
                  </div>
                )}
              </th>
              <td className={`px-6 py-4 text-right font-mono ${item.amount2025 < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {isEditing ? (
                  <textarea
                    value={getDisplayValue(index, 'amount2025', item.amount2025)}
                    onChange={(e) => handleItemEdit(index, 'amount2025', e.target.value)}
                    className={`${editableClass} w-full min-h-[2rem] resize-none bg-transparent text-right`}
                    rows={1}
                    placeholder="0"
                    onFocus={() => handleFocus(`${index}-amount2025`)}
                    onBlur={() => handleBlur(`${index}-amount2025`)}
                    maxLength={20}
                  />
                ) : (
                  formatCurrency(item.amount2025)
                )}
              </td>
              <td className={`px-6 py-4 text-right font-mono ${item.amount2024 < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                {isEditing ? (
                  <textarea
                    value={getDisplayValue(index, 'amount2024', item.amount2024)}
                    onChange={(e) => handleItemEdit(index, 'amount2024', e.target.value)}
                    className={`${editableClass} w-full min-h-[2rem] resize-none bg-transparent text-right`}
                    rows={1}
                    placeholder="0"
                    onFocus={() => handleFocus(`${index}-amount2024`)}
                    onBlur={() => handleBlur(`${index}-amount2024`)}
                    maxLength={20}
                  />
                ) : (
                  formatCurrency(item.amount2024)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* Security notice for users */}
      {isEditing && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs text-yellow-800">
            <span className="font-semibold">Security Notice:</span> All input is sanitized and validated. 
            Only plain text is allowed - HTML and scripts are automatically removed.
          </p>
        </div>
      )}
    </div>
  );
};

export default ComparisonTable;