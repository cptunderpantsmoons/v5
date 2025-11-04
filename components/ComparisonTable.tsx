import React from 'react';
import type { FinancialItem } from '../types';

interface ComparisonTableProps {
  items: FinancialItem[];
  isEditing: boolean;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};


const ComparisonTable: React.FC<ComparisonTableProps> = ({ items, isEditing }) => {
  const editableClass = isEditing ? 'p-1 rounded outline-dashed outline-1 outline-sky-500' : '';
  
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
          {items.map((item) => (
            <tr key={item.item} className="border-b border-gray-200 hover:bg-gray-50">
              <th scope="row" className="px-6 py-4 font-medium text-gray-800 whitespace-nowrap">
                <span contentEditable={isEditing} suppressContentEditableWarning={true} className={editableClass}>
                    {item.item}
                </span>
                {item.noteRef && (
                  <a href={`#note-${item.noteRef}`} className="ml-2 text-gray-500 hover:text-sky-600 no-underline" title={`Reference to Note ${item.noteRef}`}>
                    <sup className="text-xs font-mono py-0.5 px-1.5 rounded-sm bg-gray-200">({item.noteRef})</sup>
                  </a>
                )}
              </th>
              <td 
                contentEditable={isEditing}
                suppressContentEditableWarning={true}
                className={`px-6 py-4 text-right font-mono ${item.amount2025 < 0 ? 'text-red-600' : 'text-gray-900'} ${editableClass}`}
               >
                {formatCurrency(item.amount2025)}
              </td>
              <td 
                contentEditable={isEditing}
                suppressContentEditableWarning={true}
                className={`px-6 py-4 text-right font-mono ${item.amount2024 < 0 ? 'text-red-600' : 'text-gray-600'} ${editableClass}`}
              >
                {formatCurrency(item.amount2024)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ComparisonTable;