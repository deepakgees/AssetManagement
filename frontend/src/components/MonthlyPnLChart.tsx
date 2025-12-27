import React from 'react';
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
  entryDate?: string;
  recordType?: 'pnl' | 'dividend';
}

interface MonthlyPnLChartProps {
  records: PnLRecord[];
}

const MonthlyPnLChart: React.FC<MonthlyPnLChartProps> = ({ records }) => {
  // Get the last 12 months of data
  const getLast12Months = () => {
    const months: string[] = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      months.push(monthName);
    }
    
    return months;
  };

  const getMonthKey = (dateString: string): string => {
    const date = new Date(dateString);
    const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    return monthName;
  };

  const last12Months = getLast12Months();

  // Aggregate profits by month
  const monthlyData = last12Months.map(month => {
    const monthRecords = records.filter(record => {
      const recordMonth = getMonthKey(record.exitDate || record.entryDate || '');
      return recordMonth === month;
    });
    
    const totalProfit = monthRecords.reduce((sum, record) => sum + (record.profit || 0), 0);
    return totalProfit;
  });

  const chartData = {
    labels: last12Months,
    datasets: [
      {
        label: 'Monthly Profit/Loss',
        data: monthlyData,
        borderColor: '#3B82F6',
        backgroundColor: '#3B82F620',
        borderWidth: 3,
        fill: false,
        tension: 0.1,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: '#3B82F6',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          boxWidth: 12,
          boxHeight: 12,
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const value = context.parsed.y;
            return `Profit/Loss: ₹${value.toLocaleString('en-IN')}`;
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Month',
          font: {
            size: 12,
            weight: 'bold' as const,
          },
        },
        ticks: {
          display: true,
          maxRotation: 45,
          minRotation: 0,
          color: '#374151',
          font: {
            size: 11,
          },
        },
        grid: {
          display: true,
          color: '#E5E7EB',
        },
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Profit/Loss (₹)',
          font: {
            size: 12,
            weight: 'bold' as const,
          },
        },
        ticks: {
          display: true,
          color: '#374151',
          font: {
            size: 11,
          },
          callback: function(value: any) {
            return '₹' + value.toLocaleString('en-IN');
          },
        },
        grid: {
          display: true,
        },
        beginAtZero: false,
        grace: '5%',
      },
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
    elements: {
      point: {
        radius: 4,
        hoverRadius: 6,
      },
      line: {
        tension: 0.1,
      },
    },
  };

  if (!records || records.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No P&L records available for monthly trend
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height: '350px', width: '100%' }}>
      <Line data={chartData} options={options} />
    </div>
  );
};

export default MonthlyPnLChart;

