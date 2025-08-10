import api from './api';

export interface Position {
  id: number;
  tradingSymbol: string;
  quantity: number;
  averagePrice: number;
  lastPrice: number;
  marketValue: number;
  pnl: number;
  pnlPercentage: number;
  exchange: string;
  product: string;
  side: string;
  accountId: number;
  account?: {
    id: number;
    name: string;
  };
  createdAt: string;
  updatedAt?: string;
}

export interface CreatePositionData {
  tradingSymbol: string;
  quantity: number;
  averagePrice: number;
  lastPrice: number;
  exchange: string;
  product: string;
  side: string;
  accountId: number;
}

export interface UpdatePositionData {
  tradingSymbol?: string;
  quantity?: number;
  averagePrice?: number;
  lastPrice?: number;
  exchange?: string;
  product?: string;
  side?: string;
}

// Get live positions from Zerodha for a specific account
export const getLivePositions = async (accountId: number): Promise<Position[]> => {
  const response = await api.get(`/positions/live/${accountId}`);
  return response.data.positions;
};

// Get all positions (database or live based on account selection)
export const getPositions = async (accountId?: number): Promise<Position[]> => {
  if (accountId) {
    // If specific account is selected, try to get live data first
    try {
      return await getLivePositions(accountId);
    } catch (error) {
      console.warn('Failed to fetch live positions, falling back to database:', error);
      // Fall back to database positions
      const params = `?accountId=${accountId}`;
      const response = await api.get(`/positions${params}`);
      return response.data.positions;
    }
  } else {
    // If "All Accounts" is selected, use database positions
    const response = await api.get('/positions');
    return response.data.positions;
  }
};

// Get positions summary
export const getPositionsSummary = async (accountId?: number) => {
  if (accountId) {
    // Try to get live summary first
    try {
      const response = await api.get(`/positions/live/${accountId}`);
      return {
        summary: response.data.summary,
        source: response.data.source,
        lastUpdated: response.data.lastUpdated
      };
    } catch (error) {
      console.warn('Failed to fetch live summary, falling back to database:', error);
      // Fall back to database summary
      const params = `?accountId=${accountId}`;
      const response = await api.get(`/positions/summary${params}`);
      return response.data;
    }
  } else {
    // If "All Accounts" is selected, use database summary
    const response = await api.get('/positions/summary');
    return response.data;
  }
};

// Create a new position
export const createPosition = async (positionData: CreatePositionData): Promise<Position> => {
  const response = await api.post('/positions', positionData);
  return response.data.position;
};

// Update a position
export const updatePosition = async (id: number, positionData: UpdatePositionData): Promise<Position> => {
  const response = await api.put(`/positions/${id}`, positionData);
  return response.data.position;
};

// Delete a position
export const deletePosition = async (id: number): Promise<void> => {
  await api.delete(`/positions/${id}`);
}; 