import api from './api';

export interface Holding {
  id: number;
  tradingSymbol: string;
  quantity: number;
  collateralQuantity?: number;
  averagePrice: number;
  lastPrice: number;
  marketValue: number;
  pnl: number;
  pnlPercentage: number;
  exchange: string;
  sector: string;
  accountId: number;
  account?: {
    id: number;
    name: string;
  };
  createdAt: string;
  updatedAt?: string;
}

export interface CreateHoldingData {
  tradingSymbol: string;
  quantity: number;
  collateralQuantity?: number;
  averagePrice: number;
  lastPrice: number;
  exchange: string;
  sector: string;
  accountId: number;
}

export interface UpdateHoldingData {
  tradingSymbol?: string;
  quantity?: number;
  collateralQuantity?: number;
  averagePrice?: number;
  lastPrice?: number;
  exchange?: string;
  sector?: string;
}

export interface HoldingsSummary {
  summary: {
    totalHoldings: number;
    totalMarketValue: number;
    totalPnL: number;
    totalPnLPercentage: number;
    totalInvestment: number;
  };
  sectorBreakdown: Record<string, { value: number; count: number }>;
  holdings: Holding[];
}

// Get all holdings (database)
export const getHoldings = async (accountId?: number): Promise<Holding[]> => {
  const params = accountId ? `?accountId=${accountId}` : '';
  const response = await api.get(`/holdings${params}`);
  return response.data.holdings;
};

// Get holdings summary
export const getHoldingsSummary = async (accountId?: number): Promise<HoldingsSummary> => {
  const params = accountId ? `?accountId=${accountId}` : '';
  const response = await api.get(`/holdings/summary${params}`);
  return response.data;
};

// Create a new holding
export const createHolding = async (holdingData: CreateHoldingData): Promise<Holding> => {
  const response = await api.post('/holdings', holdingData);
  return response.data.holding;
};

// Update a holding
export const updateHolding = async (id: number, holdingData: UpdateHoldingData): Promise<Holding> => {
  const response = await api.put(`/holdings/${id}`, holdingData);
  return response.data.holding;
};

// Delete a holding
export const deleteHolding = async (id: number): Promise<void> => {
  await api.delete(`/holdings/${id}`);
};
