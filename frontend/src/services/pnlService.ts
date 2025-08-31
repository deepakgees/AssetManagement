import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:7001/api';

export interface PnLUpload {
  id: number;
  accountId: number;
  fileName: string;
  uploadDate: string;
  status: 'processing' | 'completed' | 'failed';
  _count: {
    records: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PnLRecord {
  id: number;
  uploadId: number;
  instrumentType: string;
  symbol?: string;
  isin?: string;
  entryDate?: string;
  exitDate?: string;
  quantity?: number;
  buyValue?: number;
  sellValue?: number;
  profit?: number;
  periodOfHolding?: string;
  fairMarketValue?: number;
  taxableProfit?: number;
  turnover?: number;
  brokerage?: number;
  exchangeTransactionCharges?: number;
  ipft?: number;
  sebiCharges?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  stampDuty?: number;
  stt?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PnLSummary {
  instrumentType: string;
  _sum: {
    profit?: number;
    buyValue?: number;
    sellValue?: number;
    quantity?: number;
    brokerage?: number;
    stt?: number;
  };
  _count: {
    id: number;
  };
}

class PnLService {
  // Parse CSV file and check for duplicates before upload
  async parseAndCheckDuplicates(file: File, accountId: number): Promise<{
    totalRecords: number;
    duplicateCount: number;
    duplicates: any[];
    uniqueRecords: number;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('accountId', accountId.toString());

    const response = await axios.post(`${API_BASE_URL}/pnl/parse-and-check-duplicates/${accountId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  }

  // Upload P&L CSV file
  async uploadFile(file: File, accountId: number, skipDuplicates: boolean = false): Promise<{ message: string; uploadId: number; status: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('accountId', accountId.toString());
    formData.append('skipDuplicates', skipDuplicates.toString());

    const response = await axios.post(`${API_BASE_URL}/pnl/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  }

  // Get all P&L uploads for an account
  async getUploads(accountId: number): Promise<PnLUpload[]> {
    const response = await axios.get(`${API_BASE_URL}/pnl/uploads/${accountId}`);
    return response.data;
  }

  // Get all records for an account (across all uploads)
  async getAccountRecords(accountId: number): Promise<PnLRecord[]> {
    const response = await axios.get(`${API_BASE_URL}/pnl/account/${accountId}/records`);
    return response.data;
  }

  // Get family-level P&L records
  async getFamilyRecords(familyName?: string): Promise<PnLRecord[]> {
    const params = new URLSearchParams();
    if (familyName) {
      params.append('familyName', familyName);
    }
    const response = await axios.get(`${API_BASE_URL}/pnl/family/records?${params}`);
    return response.data;
  }

  // Get family-level P&L summary
  async getFamilySummary(familyName?: string): Promise<PnLSummary[]> {
    const params = new URLSearchParams();
    if (familyName) {
      params.append('familyName', familyName);
    }
    const response = await axios.get(`${API_BASE_URL}/pnl/family/summary?${params}`);
    return response.data;
  }

  // Get P&L records by instrument type
  async getRecords(uploadId: number, instrumentType: string): Promise<PnLRecord[]> {
    const response = await axios.get(`${API_BASE_URL}/pnl/records/${uploadId}/${encodeURIComponent(instrumentType)}`);
    return response.data;
  }

  // Get summary by instrument type for an upload
  async getSummary(uploadId: number): Promise<PnLSummary[]> {
    const response = await axios.get(`${API_BASE_URL}/pnl/summary/${uploadId}`);
    return response.data;
  }

  // Delete P&L upload
  async deleteUpload(uploadId: number): Promise<{ message: string }> {
    const response = await axios.delete(`${API_BASE_URL}/pnl/upload/${uploadId}`);
    return response.data;
  }
}

export const pnlService = new PnLService();
