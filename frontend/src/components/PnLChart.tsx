import React, { useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface PnLRecord {
  id: number;
  instrumentType: string;
  profit: number;
  exitDate: string;
  recordType?: 'pnl' | 'dividend';
}

interface PnLChartProps {
  records: PnLRecord[];
}

const PnLChart: React.FC<PnLChartProps> = ({ records }) => {
  const [showConsolidated, setShowConsolidated] = useState(true);

  // Get unique instrument types
  const instrumentTypes = Array.from(
    new Set(records.map(record => record.instrumentType))
  ).filter(type => type !== 'Dividend'); // Exclude dividend from chart for now

  // Get financial years from records
  const getFinancialYear = (dateString: string): string => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // getMonth() returns 0-11
    
    // Financial year starts from April (month 4)
    if (month >= 4) {
      return `${year}-${year + 1}`;
    } else {
      return `${year - 1}-${year}`;
    }
  };

  const financialYears = Array.from(
    new Set(records.map(record => getFinancialYear(record.exitDate)))
  ).sort();

  // Generate colors for different instrument types
  const colors = [
    '#3B82F6', // Blue
    '#EF4444', // Red
    '#10B981', // Green
    '#F59E0B', // Yellow
    '#8B5CF6', // Purple
    '#F97316', // Orange
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#EC4899', // Pink
    '#6B7280', // Gray
  ];

  const generateDatasets = () => {
    if (showConsolidated) {
      // Show consolidated "All Types" line
      const consolidatedData = financialYears.map(year => {
        const yearRecords = records.filter(record => 
          getFinancialYear(record.exitDate) === year
        );
        
        return yearRecords.reduce((sum, record) => sum + (record.profit || 0), 0);
      });

      return [{
        label: 'All Types',
        data: consolidatedData,
        borderColor: '#1F2937', // Dark gray for consolidated line
        backgroundColor: '#1F293720',
        borderWidth: 3,
        fill: false,
        tension: 0.1,
      }];
    } else {
      // Show individual instrument type lines
      return instrumentTypes.map((instrumentType, index) => {
        const data = financialYears.map(year => {
          const yearRecords = records.filter(record => 
            record.instrumentType === instrumentType && 
            getFinancialYear(record.exitDate) === year
          );
          
          return yearRecords.reduce((sum, record) => sum + (record.profit || 0), 0);
        });

        return {
          label: instrumentType,
          data: data,
          borderColor: colors[index % colors.length],
          backgroundColor: colors[index % colors.length] + '20',
          borderWidth: 2,
          fill: false,
          tension: 0.1,
        };
      });
    }
  };

  const datasets = generateDatasets();

  const chartData = {
    labels: financialYears,
    datasets: datasets,
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
        },
      },
      title: {
        display: true,
        text: showConsolidated ? 'Consolidated Profit/Loss Trend' : 'Profit/Loss Trend by Instrument Type',
        font: {
          size: 16,
          weight: 'bold' as const,
        },
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const value = context.parsed.y;
            return `${context.dataset.label}: ₹${value.toLocaleString('en-IN')}`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Financial Year',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Profit/Loss (₹)',
        },
        ticks: {
          callback: function(value: any) {
            return '₹' + value.toLocaleString('en-IN');
          },
        },
      },
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
  };

  if (financialYears.length === 0 || instrumentTypes.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Profit/Loss Trend</h3>
        <div className="text-center text-gray-500 py-8">
          No data available for chart visualization
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      {/* Toggle Button */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Profit/Loss Trend</h3>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">View:</span>
          <button
            onClick={() => setShowConsolidated(true)}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
              showConsolidated
                ? 'bg-gray-800 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Consolidated
          </button>
          <button
            onClick={() => setShowConsolidated(false)}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
              !showConsolidated
                ? 'bg-gray-800 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            By Type
          </button>
        </div>
      </div>
      
      <Line data={chartData} options={options} />
    </div>
  );
};

export default PnLChart;
