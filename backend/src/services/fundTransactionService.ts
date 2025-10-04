import { PrismaClient } from '@prisma/client';
import csv from 'csv-parser';
import { Readable } from 'stream';

const prisma = new PrismaClient();

export interface FundTransaction {
  id: number;
  accountId: number;
  transactionDate: Date;
  amount: number;
  type: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  account?: {
    id: number;
    name: string;
    family?: string;
  };
}

export interface CreateFundTransactionData {
  accountId: number;
  transactionDate: Date;
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

export interface LedgerRow {
  particulars: string;
  posting_date: string;
  cost_center: string;
  voucher_type: string;
  debit: string;
  credit: string;
  net_balance: string;
}

export interface ParsedTransaction {
  particulars: string;
  posting_date: Date;
  amount: number;
  type: string;
}

export class FundTransactionService {
  // Create a new fund transaction
  static async createTransaction(data: CreateFundTransactionData): Promise<FundTransaction> {
    return await prisma.fundTransaction.create({
      data: {
        accountId: data.accountId,
        transactionDate: data.transactionDate,
        amount: data.amount,
        type: data.type,
        description: data.description,
      },
    });
  }

  // Get all transactions for an account
  static async getAccountTransactions(accountId: number): Promise<FundTransaction[]> {
    return await prisma.fundTransaction.findMany({
      where: { accountId },
      orderBy: { transactionDate: 'asc' },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            family: true,
          },
        },
      },
    });
  }

  // Get all transactions for a family (all accounts in the family)
  static async getFamilyTransactions(familyName: string): Promise<FundTransaction[]> {
    const accounts = await prisma.account.findMany({
      where: { family: familyName },
      select: { id: true },
    });

    const accountIds = accounts.map(acc => acc.id);

    return await prisma.fundTransaction.findMany({
      where: { accountId: { in: accountIds } },
      orderBy: { transactionDate: 'asc' },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            family: true,
          },
        },
      },
    });
  }

  // Update a transaction
  static async updateTransaction(id: number, data: Partial<CreateFundTransactionData>): Promise<FundTransaction> {
    return await prisma.fundTransaction.update({
      where: { id },
      data,
    });
  }

  // Delete a transaction
  static async deleteTransaction(id: number): Promise<void> {
    await prisma.fundTransaction.delete({
      where: { id },
    });
  }

  // Parse CSV file and check for duplicates
  static async parseAndCheckDuplicates(fileBuffer: Buffer, accountId: number): Promise<{
    totalRecords: number;
    duplicateCount: number;
    duplicates: ParsedTransaction[];
    uniqueRecords: ParsedTransaction[];
  }> {
    const parsedTransactions = await this.parseLedgerCSV(fileBuffer);
    
    // Get existing transactions for the account
    const existingTransactions = await this.getAccountTransactions(accountId);
    
    // Check for duplicates based on date, amount, and type
    const duplicates: ParsedTransaction[] = [];
    const uniqueRecords: ParsedTransaction[] = [];
    
    for (const transaction of parsedTransactions) {
      const isDuplicate = existingTransactions.some(existing => 
        existing.transactionDate.toISOString().split('T')[0] === transaction.posting_date.toISOString().split('T')[0] &&
        existing.amount === transaction.amount &&
        existing.type === transaction.type
      );
      
      if (isDuplicate) {
        duplicates.push(transaction);
      } else {
        uniqueRecords.push(transaction);
      }
    }
    
    return {
      totalRecords: parsedTransactions.length,
      duplicateCount: duplicates.length,
      duplicates,
      uniqueRecords
    };
  }

  // Parse CSV file and extract fund transactions
  static async parseLedgerCSV(fileBuffer: Buffer): Promise<ParsedTransaction[]> {
    return new Promise((resolve, reject) => {
      const transactions: ParsedTransaction[] = [];
      const stream = Readable.from(fileBuffer.toString());

      stream
        .pipe(csv())
        .on('data', (row: LedgerRow) => {
          // Filter out unwanted voucher types
          if (row.voucher_type === 'Book Voucher' || row.voucher_type === 'Delivery Voucher') {
            return;
          }

          // Skip opening balance
          if (row.particulars === 'Opening Balance') {
            return;
          }

          const debitAmount = parseFloat(row.debit) || 0;
          const creditAmount = parseFloat(row.credit) || 0;

          // Process debit transactions (withdrawals)
          if (debitAmount > 0) {
            transactions.push({
              particulars: row.particulars,
              posting_date: new Date(row.posting_date),
              amount: debitAmount,
              type: 'WITHDRAWAL'
            });
          }

          // Process credit transactions (additions)
          if (creditAmount > 0) {
            transactions.push({
              particulars: row.particulars,
              posting_date: new Date(row.posting_date),
              amount: creditAmount,
              type: 'ADDITION'
            });
          }
        })
        .on('end', () => {
          resolve(transactions);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  // Bulk create transactions from CSV
  static async createTransactionsFromCSV(accountId: number, transactions: ParsedTransaction[]): Promise<FundTransaction[]> {
    const createdTransactions: FundTransaction[] = [];

    for (const transaction of transactions) {
      const created = await prisma.fundTransaction.create({
        data: {
          accountId,
          transactionDate: transaction.posting_date,
          amount: transaction.amount,
          type: transaction.type,
          description: transaction.particulars,
        },
      });
      createdTransactions.push(created);
    }

    return createdTransactions;
  }

  // Calculate XIRR for an account
  static async calculateAccountXIRR(accountId: number, currentValue: number): Promise<XIRRCalculation> {
    const transactions = await this.getAccountTransactions(accountId);
    return this.calculateXIRR(transactions, currentValue);
  }

  // Calculate XIRR for a family
  static async calculateFamilyXIRR(familyName: string, currentValue: number): Promise<XIRRCalculation> {
    const transactions = await this.getFamilyTransactions(familyName);
    return this.calculateXIRR(transactions, currentValue);
  }

  // Core XIRR calculation logic
  private static calculateXIRR(transactions: FundTransaction[], currentValue: number): XIRRCalculation {
    if (transactions.length === 0) {
      return {
        xirr: 0,
        totalInvested: 0,
        currentValue,
        totalGain: currentValue,
        totalGainPercentage: 0,
      };
    }

    // Prepare cash flows for XIRR calculation
    const cashFlows: { date: Date; amount: number }[] = [];
    
    // Add all transactions
    transactions.forEach(transaction => {
      const amount = transaction.type === 'ADDITION' ? -transaction.amount : transaction.amount;
      cashFlows.push({
        date: transaction.transactionDate,
        amount,
      });
    });

    // Add current value as final positive cash flow
    const today = new Date();
    cashFlows.push({
      date: today,
      amount: currentValue,
    });

    // Sort by date
    cashFlows.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate total invested
    const totalInvested = transactions
      .filter(t => t.type === 'ADDITION')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalWithdrawn = transactions
      .filter(t => t.type === 'WITHDRAWAL')
      .reduce((sum, t) => sum + t.amount, 0);

    const netInvested = totalInvested - totalWithdrawn;
    const totalGain = currentValue - netInvested;
    const totalGainPercentage = netInvested > 0 ? (totalGain / netInvested) * 100 : 0;

    // Calculate XIRR using Newton-Raphson method
    const xirr = this.calculateXIRRValue(cashFlows);

    return {
      xirr,
      totalInvested: netInvested,
      currentValue,
      totalGain,
      totalGainPercentage,
    };
  }

  // XIRR calculation using Newton-Raphson method
  private static calculateXIRRValue(cashFlows: { date: Date; amount: number }[]): number {
    if (cashFlows.length < 2) return 0;

    // Initial guess
    let rate = 0.1; // 10% initial guess
    const maxIterations = 100;
    const tolerance = 1e-6;

    for (let i = 0; i < maxIterations; i++) {
      let npv = 0;
      let npvDerivative = 0;

      cashFlows.forEach(cf => {
        const daysDiff = (cf.date.getTime() - cashFlows[0].date.getTime()) / (1000 * 60 * 60 * 24);
        const years = daysDiff / 365.25;
        
        const factor = Math.pow(1 + rate, -years);
        npv += cf.amount * factor;
        npvDerivative += cf.amount * factor * (-years) / (1 + rate);
      });

      if (Math.abs(npv) < tolerance) {
        break;
      }

      if (Math.abs(npvDerivative) < tolerance) {
        break;
      }

      rate = rate - npv / npvDerivative;

      // Prevent extreme values
      if (rate < -0.99) rate = -0.99;
      if (rate > 10) rate = 10;
    }

    return rate * 100; // Convert to percentage
  }
}
