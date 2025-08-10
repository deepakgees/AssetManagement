import { useState } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  LinearProgress,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Box,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';

// Mock data for demonstration
const mockHoldings = [
  {
    tradingSymbol: 'RELIANCE',
    quantity: 100,
    averagePrice: 2500,
    lastPrice: 2750,
    marketValue: 275000,
    pnl: 25000,
    pnlPercentage: 10,
    accountName: 'Primary Account',
    exchange: 'NSE',
    sector: 'Oil & Gas',
  },
  {
    tradingSymbol: 'TCS',
    quantity: 50,
    averagePrice: 3200,
    lastPrice: 3400,
    marketValue: 170000,
    pnl: 10000,
    pnlPercentage: 6.25,
    accountName: 'Secondary Account',
    exchange: 'NSE',
    sector: 'IT',
  },
  {
    tradingSymbol: 'HDFC',
    quantity: 75,
    averagePrice: 1800,
    lastPrice: 1900,
    marketValue: 142500,
    pnl: 7500,
    pnlPercentage: 4.17,
    accountName: 'Primary Account',
    exchange: 'NSE',
    sector: 'Banking',
  },
  {
    tradingSymbol: 'INFY',
    quantity: 200,
    averagePrice: 1500,
    lastPrice: 1600,
    marketValue: 320000,
    pnl: 20000,
    pnlPercentage: 13.33,
    accountName: 'Secondary Account',
    exchange: 'NSE',
    sector: 'IT',
  },
];

const mockSectorData = [
  { name: 'IT', value: 490000, color: '#8884d8' },
  { name: 'Banking', value: 142500, color: '#82ca9d' },
  { name: 'Oil & Gas', value: 275000, color: '#ffc658' },
];

export default function Holdings() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [selectedSector, setSelectedSector] = useState('all');

  // Mock API calls
  const { data: holdingsData, isLoading } = useQuery({
    queryKey: ['holdings'],
    queryFn: () => Promise.resolve(mockHoldings),
    refetchInterval: 30000
  });

  const { data: sectorData } = useQuery({
    queryKey: ['sectorData'],
    queryFn: () => Promise.resolve(mockSectorData)
  });

  const handleRefresh = () => {
    toast.success('Holdings data refreshed!');
  };

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

  // Filter holdings based on search and filters
  const filteredHoldings = holdingsData?.filter(holding => {
    const matchesSearch = holding.tradingSymbol.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAccount = selectedAccount === 'all' || holding.accountName === selectedAccount;
    const matchesSector = selectedSector === 'all' || holding.sector === selectedSector;
    return matchesSearch && matchesAccount && matchesSector;
  }) || [];

  // Calculate summary data
  const totalMarketValue = filteredHoldings.reduce((sum, h) => sum + h.marketValue, 0);
  const totalPnL = filteredHoldings.reduce((sum, h) => sum + h.pnl, 0);
  const totalInvestment = filteredHoldings.reduce((sum, h) => sum + (h.averagePrice * h.quantity), 0);
  const totalPnLPercentage = totalInvestment > 0 ? (totalPnL / totalInvestment) * 100 : 0;

  // Get unique accounts and sectors for filters
  const accounts = Array.from(new Set(holdingsData?.map(h => h.accountName) || []));
  const sectors = Array.from(new Set(holdingsData?.map(h => h.sector) || []));

  return (
    <Layout title="Holdings" showRefresh onRefresh={handleRefresh}>
      {isLoading && <LinearProgress />}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Holdings
              </Typography>
              <Typography variant="h4" component="div">
                {filteredHoldings.length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Filtered results
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Market Value
              </Typography>
              <Typography variant="h4" component="div">
                {formatCurrency(totalMarketValue)}
              </Typography>
              <Chip
                label={formatPercentage(totalPnLPercentage)}
                color={totalPnLPercentage >= 0 ? 'success' : 'error'}
                size="small"
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total P&L
              </Typography>
              <Typography variant="h4" component="div">
                {formatCurrency(totalPnL)}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                {totalPnL >= 0 ? (
                  <TrendingUpIcon color="success" />
                ) : (
                  <TrendingDownIcon color="error" />
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Average P&L %
              </Typography>
              <Typography variant="h4" component="div">
                {totalPnLPercentage.toFixed(2)}%
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Weighted average
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            label="Search by symbol"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Account</InputLabel>
            <Select
              value={selectedAccount}
              label="Account"
              onChange={(e) => setSelectedAccount(e.target.value)}
            >
              <MenuItem value="all">All Accounts</MenuItem>
              {accounts.map((account) => (
                <MenuItem key={account} value={account}>
                  {account}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Sector</InputLabel>
            <Select
              value={selectedSector}
              label="Sector"
              onChange={(e) => setSelectedSector(e.target.value)}
            >
              <MenuItem value="all">All Sectors</MenuItem>
              {sectors.map((sector) => (
                <MenuItem key={sector} value={sector}>
                  {sector}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={3}>
          <Button
            variant="outlined"
            startIcon={<FilterIcon />}
            onClick={() => {
              setSearchTerm('');
              setSelectedAccount('all');
              setSelectedSector('all');
            }}
            fullWidth
          >
            Clear Filters
          </Button>
        </Grid>
      </Grid>

      {/* Charts and Table */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Sector Allocation
              </Typography>
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
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Holdings Details
              </Typography>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Symbol</TableCell>
                      <TableCell align="right">Quantity</TableCell>
                      <TableCell align="right">Avg Price</TableCell>
                      <TableCell align="right">Last Price</TableCell>
                      <TableCell align="right">Market Value</TableCell>
                      <TableCell align="right">P&L</TableCell>
                      <TableCell align="right">P&L %</TableCell>
                      <TableCell>Sector</TableCell>
                      <TableCell>Account</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredHoldings.map((holding, index) => (
                      <TableRow key={index}>
                        <TableCell component="th" scope="row">
                          {holding.tradingSymbol}
                        </TableCell>
                        <TableCell align="right">{holding.quantity}</TableCell>
                        <TableCell align="right">{formatCurrency(holding.averagePrice)}</TableCell>
                        <TableCell align="right">{formatCurrency(holding.lastPrice)}</TableCell>
                        <TableCell align="right">{formatCurrency(holding.marketValue)}</TableCell>
                        <TableCell align="right" sx={{ color: holding.pnl >= 0 ? 'success.main' : 'error.main' }}>
                          {formatCurrency(holding.pnl)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: holding.pnlPercentage >= 0 ? 'success.main' : 'error.main' }}>
                          {formatPercentage(holding.pnlPercentage)}
                        </TableCell>
                        <TableCell>{holding.sector}</TableCell>
                        <TableCell>{holding.accountName}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Layout>
  );
} 