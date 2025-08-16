import api from './api';

export interface Margin {
  id: number;
  accountId: number;
  segment: string;
  enabled: boolean;
  net: number;
  debits: number;
  payout: number;
  liquidCollateral: number;
  stockCollateral: number;
  span: number;
  exposure: number;
  additional: number;
  delivery: number;
  optionPremium: number;
  holdingSales: number;
  turnover: number;
  equity: number;
  m2mRealised: number;
  m2mUnrealised: number;
  createdAt: string;
  updatedAt: string;
  account: {
    id: number;
    name: string;
  };
}

export const getMargins = async (): Promise<Margin[]> => {
  const response = await api.get('/margins');
  return response.data;
};

export const getMarginsByAccount = async (accountId: number): Promise<Margin> => {
  const response = await api.get(`/margins/account/${accountId}`);
  return response.data;
};

export const getMarginsSummary = async (): Promise<Margin[]> => {
  const response = await api.get('/margins/summary');
  return response.data;
};

export const syncMargins = async (accountId: number): Promise<{ message: string; margins: Margin }> => {
  const response = await api.post(`/margins/sync/${accountId}`);
  return response.data;
};
