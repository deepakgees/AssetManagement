import React, { useMemo } from 'react';

interface PnLRecord {
  id: number;
  instrumentType: string;
  profit: number;
  exitDate: string;
  entryDate?: string;
  recordType?: 'pnl' | 'dividend';
  account?: {
    id: number;
    name: string;
    family?: string;
  };
  accountId?: number;
}

interface MonthlyPnLTableProps {
  records: PnLRecord[];
}

const MonthlyPnLTable: React.FC<MonthlyPnLTableProps> = ({ records }) => {
  // Color palette for different family members - using more distinguishable colors
  const memberColors = [
    { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', name: 'Blue' },
    { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', name: 'Green' },
    { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', name: 'Red' },
    { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', name: 'Orange' },
    { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300', name: 'Purple' },
    { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-300', name: 'Cyan' },
    { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-300', name: 'Pink' },
    { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', name: 'Amber' },
    { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', name: 'Emerald' },
    { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-300', name: 'Violet' },
  ];

  // Map instrument types to simplified categories
  const getInstrumentCategory = (instrumentType: string): string => {
    const type = instrumentType.toLowerCase();
    if (type.includes('f&o') || type.includes('fo')) {
      return 'F&O';
    }
    if (type.includes('equity')) {
      return 'EQ';
    }
    if (type.includes('mutual fund')) {
      return 'MF';
    }
    if (type.includes('currency')) {
      return 'Currency';
    }
    if (type.includes('commodity') || type.includes('commodities')) {
      return 'Commodities';
    }
    // Default to instrument type if no match
    return instrumentType;
  };

  // Get account name from record
  const getAccountName = (record: PnLRecord): string => {
    if (record.account?.name) {
      return record.account.name;
    }
    return `Account ${record.accountId || record.id}`;
  };

  // Get the last 12 months (excluding current month)
  const getLast12Months = () => {
    const months: Array<{ label: string; startDate: Date; endDate: Date; key: string }> = [];
    const now = new Date();
    
    // Start from 12 months ago and go up to 1 month ago (excluding current month)
    for (let i = 12; i >= 1; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthName = date.toLocaleDateString('en-US', { month: 'long' }); // Full month name (e.g., "June")
      const year = date.getFullYear();
      const yearShort = year.toString().slice(-2); // Last 2 digits of year (e.g., "25")
      const monthNum = date.getMonth() + 1;
      // Format: "June-25" (full month name and last 2 digits of year)
      const label = `${monthName}-${yearShort}`;
      const key = `${year}-${String(monthNum).padStart(2, '0')}`;
      
      months.push({ label, startDate: date, endDate, key });
    }
    
    return months;
  };

  // Get current month data
  const getCurrentMonth = () => {
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthName = date.toLocaleDateString('en-US', { month: 'long' });
    const year = date.getFullYear();
    const yearShort = year.toString().slice(-2);
    const monthNum = date.getMonth() + 1;
    const label = `${monthName}-${yearShort}`;
    const key = `${year}-${String(monthNum).padStart(2, '0')}`;
    
    return { label, startDate: date, endDate, key };
  };

  const getMonthKey = (dateString: string): string => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const formatCurrency = (value: number, showDecimals: boolean = false): string => {
    if (value === 0) return '0';
    return value.toLocaleString('en-IN', { 
      maximumFractionDigits: showDecimals ? 2 : 0,
      minimumFractionDigits: showDecimals ? 2 : 0
    });
  };

  // Calculate monthly data with member breakdown
  const monthlyData = useMemo(() => {
    const months = getLast12Months();
    const currentMonth = getCurrentMonth();
    const categories = new Set<string>();
    const accountNames = new Set<string>();
    
    // First pass: collect all categories and account names
    records.forEach(record => {
      const category = getInstrumentCategory(record.instrumentType);
      categories.add(category);
      accountNames.add(getAccountName(record));
    });
    
    const categoryList = Array.from(categories).sort();
    const accountList = Array.from(accountNames).sort();
    
    // Create account color mapping
    const accountColorMap: Record<string, typeof memberColors[0]> = {};
    accountList.forEach((account, index) => {
      accountColorMap[account] = memberColors[index % memberColors.length];
    });
    
    // Helper function to calculate month data
    const calculateMonthData = (month: { label: string; startDate: Date; endDate: Date; key: string }) => {
      const monthRecords = records.filter(record => {
        const recordDate = record.exitDate || record.entryDate || '';
        if (!recordDate) return false;
        const recordMonthKey = getMonthKey(recordDate);
        return recordMonthKey === month.key;
      });
      
      // Category totals by account
      const categoryByAccount: Record<string, Record<string, number>> = {};
      categoryList.forEach(cat => {
        categoryByAccount[cat] = {};
        accountList.forEach(acc => {
          categoryByAccount[cat][acc] = 0;
        });
      });
      
      // Net earnings by account
      const netEarningsByAccount: Record<string, number> = {};
      accountList.forEach(acc => {
        netEarningsByAccount[acc] = 0;
      });
      
      monthRecords.forEach(record => {
        const category = getInstrumentCategory(record.instrumentType);
        const accountName = getAccountName(record);
        const profit = record.profit || 0;
        
        categoryByAccount[category][accountName] = (categoryByAccount[category][accountName] || 0) + profit;
        netEarningsByAccount[accountName] = (netEarningsByAccount[accountName] || 0) + profit;
      });
      
      // Calculate totals
      const categoryTotals: Record<string, number> = {};
      categoryList.forEach(cat => {
        categoryTotals[cat] = Object.values(categoryByAccount[cat]).reduce((sum, val) => sum + val, 0);
      });
      const netEarnings = Object.values(netEarningsByAccount).reduce((sum, val) => sum + val, 0);
      
      return {
        month: month.label,
        categories: categoryTotals,
        categoryByAccount,
        netEarnings,
        netEarningsByAccount
      };
    };
    
    // Calculate data for each month with member breakdown (excluding current month for averages)
    const data = months.map(month => calculateMonthData(month));
    
    // Calculate current month data separately (not included in averages)
    const currentMonthData = calculateMonthData(currentMonth);
    
    // Calculate totals
    const totals: Record<string, number> = {};
    const totalsByAccount: Record<string, Record<string, number>> = {};
    categoryList.forEach(cat => {
      totals[cat] = 0;
      totalsByAccount[cat] = {};
      accountList.forEach(acc => {
        totalsByAccount[cat][acc] = 0;
      });
    });
    const netEarningsTotalsByAccount: Record<string, number> = {};
    accountList.forEach(acc => {
      netEarningsTotalsByAccount[acc] = 0;
    });
    let totalNetEarnings = 0;
    
    data.forEach(row => {
      categoryList.forEach(cat => {
        totals[cat] = (totals[cat] || 0) + (row.categories[cat] || 0);
        accountList.forEach(acc => {
          totalsByAccount[cat][acc] = (totalsByAccount[cat][acc] || 0) + (row.categoryByAccount[cat][acc] || 0);
        });
      });
      accountList.forEach(acc => {
        netEarningsTotalsByAccount[acc] = (netEarningsTotalsByAccount[acc] || 0) + (row.netEarningsByAccount[acc] || 0);
      });
      totalNetEarnings += row.netEarnings;
    });
    
    // Add Net Earnings to totals
    totals['Net Earnings'] = totalNetEarnings;
    
    // Calculate averages (divide by number of months)
    const numMonths = months.length;
    const averages: Record<string, number> = {};
    const averagesByAccount: Record<string, Record<string, number>> = {};
    categoryList.forEach(cat => {
      averages[cat] = numMonths > 0 ? totals[cat] / numMonths : 0;
      averagesByAccount[cat] = {};
      accountList.forEach(acc => {
        averagesByAccount[cat][acc] = numMonths > 0 ? totalsByAccount[cat][acc] / numMonths : 0;
      });
    });
    const netEarningsAveragesByAccount: Record<string, number> = {};
    accountList.forEach(acc => {
      netEarningsAveragesByAccount[acc] = numMonths > 0 ? netEarningsTotalsByAccount[acc] / numMonths : 0;
    });
    averages['Net Earnings'] = numMonths > 0 ? totalNetEarnings / numMonths : 0;
    
    return {
      months: data,
      currentMonth: currentMonthData,
      categories: categoryList,
      accounts: accountList,
      accountColorMap,
      totals: totals,
      totalsByAccount,
      netEarningsTotalsByAccount,
      averages: averages,
      averagesByAccount,
      netEarningsAveragesByAccount
    };
  }, [records]);

  // Render cell with member breakdown
  const renderCellWithBreakdown = (
    category: string,
    rowData: any,
    isTotal: boolean = false,
    isAverage: boolean = false
  ) => {
    const accountList = monthlyData.accounts;
    const breakdown = isTotal 
      ? monthlyData.totalsByAccount[category]
      : isAverage
      ? monthlyData.averagesByAccount[category]
      : rowData.categoryByAccount[category];
    
    const total = isTotal
      ? monthlyData.totals[category]
      : isAverage
      ? monthlyData.averages[category]
      : rowData.categories[category] || 0;
    
    // For Total and Average rows, don't show breakdown
    if (isTotal || isAverage || accountList.length <= 1) {
      return (
        <td className="px-4 py-3 text-sm text-gray-900 text-right border border-gray-300">
          <span className="font-bold">{formatCurrency(total, isAverage)}</span>
        </td>
      );
    }
    
    // Get non-zero member contributions
    const memberContributions = accountList
      .map(account => {
        const value = breakdown[account] || 0;
        if (value === 0) return null;
        const color = monthlyData.accountColorMap[account];
        return { account, value, color };
      })
      .filter(item => item !== null) as Array<{ account: string; value: number; color: typeof memberColors[0] }>;
    
    return (
      <td className="px-4 py-3 text-sm text-right border border-gray-300">
        <div className="flex flex-col items-end">
          <div className="font-bold text-black">
            {formatCurrency(total, isAverage)}
          </div>
          {memberContributions.length > 0 && (
            <div className="text-xs mt-1">
              (
              {memberContributions.map((item, index) => (
                <span key={item.account}>
                  {index > 0 && <span className="text-gray-500"> + </span>}
                  <span className={`${item.color.text} font-medium`}>
                    {formatCurrency(item.value, isAverage)}
                  </span>
                </span>
              ))}
              )
            </div>
          )}
        </div>
      </td>
    );
  };

  // Render Net Earnings cell with member breakdown
  const renderNetEarningsCell = (
    rowData: any,
    isTotal: boolean = false,
    isAverage: boolean = false
  ) => {
    const accountList = monthlyData.accounts;
    const breakdown = isTotal
      ? monthlyData.netEarningsTotalsByAccount
      : isAverage
      ? monthlyData.netEarningsAveragesByAccount
      : rowData.netEarningsByAccount;
    
    const total = isTotal
      ? monthlyData.totals['Net Earnings']
      : isAverage
      ? monthlyData.averages['Net Earnings']
      : rowData.netEarnings;
    
    // For Total and Average rows, don't show breakdown
    if (isTotal || isAverage || accountList.length <= 1) {
      return (
        <td className="px-4 py-3 text-sm font-bold text-black text-right border border-gray-300">
          {formatCurrency(total, isAverage)}
        </td>
      );
    }
    
    // Get non-zero member contributions
    const memberContributions = accountList
      .map(account => {
        const value = breakdown[account] || 0;
        if (value === 0) return null;
        const color = monthlyData.accountColorMap[account];
        return { account, value, color };
      })
      .filter(item => item !== null) as Array<{ account: string; value: number; color: typeof memberColors[0] }>;
    
    return (
      <td className="px-4 py-3 text-sm text-right border border-gray-300">
        <div className="flex flex-col items-end">
          <div className="font-bold text-black">
            {formatCurrency(total, isAverage)}
          </div>
          {memberContributions.length > 0 && (
            <div className="text-xs mt-1">
              (
              {memberContributions.map((item, index) => (
                <span key={item.account}>
                  {index > 0 && <span className="text-gray-500"> + </span>}
                  <span className={`${item.color.text} font-medium`}>
                    {formatCurrency(item.value, isAverage)}
                  </span>
                </span>
              ))}
              )
            </div>
          )}
        </div>
      </td>
    );
  };

  if (!records || records.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No P&L records available for monthly trend
      </div>
    );
  }

  // Only show legend if there are multiple accounts
  const showLegend = monthlyData.accounts.length > 1;

  return (
    <div>
      {/* Legend */}
      {showLegend && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-sm font-semibold text-gray-700 mb-2">Family Members:</div>
          <div className="flex flex-wrap gap-4">
            {monthlyData.accounts.map((account, index) => {
              const color = monthlyData.accountColorMap[account];
              return (
                <div key={account} className="flex items-center gap-2">
                  <span className={`${color.text} font-bold text-lg`}>●</span>
                  <span className="text-sm text-gray-700 font-medium">{account}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-gray-300">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300">
              Date Range
            </th>
            {monthlyData.categories.map(category => (
              <th key={category} className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300">
                {category}
              </th>
            ))}
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300">
              Net Earnings
            </th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {monthlyData.months.map((row, index) => (
            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border border-gray-300">
                {row.month}
              </td>
              {monthlyData.categories.map(category => 
                renderCellWithBreakdown(category, row)
              )}
              {renderNetEarningsCell(row)}
            </tr>
          ))}
          {/* Average Row */}
          <tr className="bg-blue-50 font-semibold">
            <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900 border-t border-gray-300 border border-gray-300">
              Average
            </td>
            {monthlyData.categories.map(category => 
              renderCellWithBreakdown(category, null, false, true)
            )}
            {renderNetEarningsCell(null, false, true)}
          </tr>
          {/* Current Month Row */}
          <tr className="bg-green-50 font-semibold">
            <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900 border-t border-gray-300 border border-gray-300">
              {monthlyData.currentMonth.month} (Current)
            </td>
            {monthlyData.categories.map(category => 
              renderCellWithBreakdown(category, monthlyData.currentMonth)
            )}
            {renderNetEarningsCell(monthlyData.currentMonth)}
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  );
};

export default MonthlyPnLTable;
