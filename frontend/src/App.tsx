import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Accounts from './pages/Accounts';
import Holdings from './pages/Holdings';
import Positions from './pages/Positions';
import PnL from './pages/PnL';
import Dividends from './pages/Dividends';
import SymbolMargins from './pages/SymbolMargins';
import HistoricalData from './pages/HistoricalData';
import FamilyDetails from './pages/FamilyDetails';
import HoldingCategoryMapping from './pages/HoldingCategoryMapping';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/" element={<Accounts />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/holdings" element={<Holdings />} />
            <Route path="/positions" element={<Positions />} />
            <Route path="/pnl" element={<PnL />} />
            <Route path="/dividends" element={<Dividends />} />
            <Route path="/symbolMargins" element={<SymbolMargins />} />
            <Route path="/historicalData" element={<HistoricalData />} />
            <Route path="/family/:familyName" element={<FamilyDetails />} />
            <Route path="/holdingCategoryMapping" element={<HoldingCategoryMapping />} />
          </Routes>
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App; 