export interface FundTransaction {
  id: number;
  accountId: number;
  transactionDate: string;
  amount: number;
  type: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  account?: {
    id: number;
    name: string;
    family?: string;
  };
}

export interface CreateFundTransactionData {
  accountId: number;
  transactionDate: string;
  amount: number;
  type: string;
  description?: string;
}

export interface XIRRCalculation {
  xirr: number;
  totalInvested: number;
  currentValue: number;
  totalGain: number;
  totalGainPercentage: number;
}
