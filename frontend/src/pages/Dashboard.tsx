import { useQuery } from '@tanstack/react-query';
import { 
  CurrencyDollarIcon, 
  ArrowTrendingUpIcon, 
  ArrowTrendingDownIcon,
  ChartBarIcon,
  UserGroupIcon 
} from '@heroicons/react/24/outline';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Layout from '../components/Layout';

// Mock data for demonstration
const mockPortfolioData = {
  totalValue: 1250000,
  totalPnL: 125000,
  totalPnLPercentage: 11.11,
  cashBalance: 50000,
  marginUsed: 200000,
  availableMargin: 300000,
};

const mockChartData = [
  { date: 'Jan', value: 1000000 },
  { date: 'Feb', value: 1050000 },
  { date: 'Mar', value: 1100000 },
  { date: 'Apr', value: 1150000 },
  { date: 'May', value: 1200000 },
  { date: 'Jun', value: 1250000 },
];

const mockSectorData = [
  { name: 'IT', value: 400000, color: '#3B82F6' },
  { name: 'Banking', value: 300000, color: '#10B981' },
  { name: 'Oil & Gas', value: 250000, color: '#F59E0B' },
  { name: 'Others', value: 300000, color: '#8B5CF6' },
];

export default function Dashboard() {
  const { data: portfolioData, isLoading } = useQuery({
    queryKey: ['portfolio'],
    queryFn: () => Promise.resolve(mockPortfolioData),
    refetchInterval: 30000,
  });

  const { data: chartData } = useQuery({
    queryKey: ['chartData'],
    queryFn: () => Promise.resolve(mockChartData),
  });

  const { data: sectorData } = useQuery({
    queryKey: ['sectorData'],
    queryFn: () => Promise.resolve(mockSectorData),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (percentage: number) => {
    return `${percentage > 0 ? '+' : ''}${percentage.toFixed(2)}%`;
  };

  return (
    <Layout>
      {isLoading && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CurrencyDollarIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Portfolio Value</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {portfolioData ? formatCurrency(portfolioData.totalValue) : 'Loading...'}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ArrowTrendingUpIcon className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total P&L</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {portfolioData ? formatCurrency(portfolioData.totalPnL) : 'Loading...'}
                  </dd>
                  <dd className="text-sm text-green-600">
                    {portfolioData ? formatPercentage(portfolioData.totalPnLPercentage) : ''}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-6 w-6 text-blue-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Cash Balance</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {portfolioData ? formatCurrency(portfolioData.cashBalance) : 'Loading...'}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UserGroupIcon className="h-6 w-6 text-purple-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Margin Used</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {portfolioData ? formatCurrency(portfolioData.marginUsed) : 'Loading...'}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Portfolio Value Chart */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Portfolio Value Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Sector Allocation */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Sector Allocation</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={sectorData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {sectorData?.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mt-8 bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                    <ArrowTrendingUpIcon className="h-4 w-4 text-green-600" />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-900">RELIANCE up 2.5%</p>
                  <p className="text-sm text-gray-500">Portfolio value increased</p>
                </div>
              </div>
              <div className="text-sm text-gray-500">2 hours ago</div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                    <ArrowTrendingDownIcon className="h-4 w-4 text-red-600" />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-900">TCS down 1.2%</p>
                  <p className="text-sm text-gray-500">Portfolio value decreased</p>
                </div>
              </div>
              <div className="text-sm text-gray-500">4 hours ago</div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <CurrencyDollarIcon className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-900">New position opened</p>
                  <p className="text-sm text-gray-500">Bought 100 shares of INFY</p>
                </div>
              </div>
              <div className="text-sm text-gray-500">1 day ago</div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
} 