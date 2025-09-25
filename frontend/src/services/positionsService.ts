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
  marginBlocked?: number;
  symbolMargin?: number;
  account?: {
    id: number;
    name: string;
  };
  // Family-level position fields
  family?: string;
  accountIds?: number[];
  accounts?: {
    id: number;
    name: string;
    family?: string;
    quantity?: number;
    averagePrice?: number;
    lastPrice?: number;
    marketValue?: number;
    pnl?: number;
  }[];
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
export const getPositions = async (accountId?: number, family?: boolean, familyName?: string): Promise<Position[]> => {
  // Always use database positions for now (skip live data attempts)
  const params = new URLSearchParams();
  if (accountId) {
    params.append('accountId', accountId.toString());
  }
  if (family) {
    params.append('family', 'true');
  }
  if (familyName) {
    params.append('familyName', familyName);
  }
  const response = await api.get(`/positions?${params}`);
  return response.data.positions;
};

// Get positions summary
export const getPositionsSummary = async (accountId?: number, family?: boolean, familyName?: string) => {
  // Always use database summary for now (skip live data attempts)
  const params = new URLSearchParams();
  if (accountId) {
    params.append('accountId', accountId.toString());
  }
  if (family) {
    params.append('family', 'true');
  }
  if (familyName) {
    params.append('familyName', familyName);
  }
  const response = await api.get(`/positions/summary?${params}`);
  return response.data;
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