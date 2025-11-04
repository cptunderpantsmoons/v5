
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { FinancialItem } from '../types';

interface ComparisonChartProps {
  data: FinancialItem[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-2 bg-white border border-gray-200 rounded-md shadow-lg">
        <p className="label font-bold text-gray-800">{`${label}`}</p>
        <p className="text-sky-600">{`2025: ${payload[0].value.toLocaleString()}`}</p>
        <p className="text-teal-500">{`2024: ${payload[1].value.toLocaleString()}`}</p>
      </div>
    );
  }

  return null;
};

const ComparisonChart: React.FC<ComparisonChartProps> = ({ data }) => {
  return (
    <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
            <BarChart
                data={data}
                margin={{
                    top: 5,
                    right: 20,
                    left: 20,
                    bottom: 5,
                }}
            >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="item" tick={{ fill: '#4A5568' }} />
                <YAxis tickFormatter={(value) => new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(value as number)} tick={{ fill: '#4A5568' }} />
                <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(127, 212, 255, 0.1)'}}/>
                <Legend wrapperStyle={{ color: '#111827' }} />
                <Bar dataKey="amount2025" fill="#0284c7" name="2025" />
                <Bar dataKey="amount2024" fill="#14b8a6" name="2024" />
            </BarChart>
        </ResponsiveContainer>
    </div>
  );
};

export default ComparisonChart;