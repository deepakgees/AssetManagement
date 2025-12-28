import express from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { serviceLogger } from '../utils/serviceLogger';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'pnl-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Configure multer for Excel file upload
const excelStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'excel-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const excelUpload = multer({ 
  storage: excelStorage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/vnd.ms-excel.sheet.macroEnabled.12' // .xlsm
    ];
    if (allowedMimes.includes(file.mimetype) || 
        file.originalname.match(/\.(xlsx|xls|xlsm)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls, .xlsm) are allowed'));
    }
  }
});

// Upload P&L CSV file
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const accountId = parseInt(req.body.accountId);
    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const skipDuplicates = req.body.skipDuplicates === 'true';

    // Verify account exists
    const account = await prisma.account.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Process the CSV file asynchronously
    processCSVFile(req.file.path, accountId, skipDuplicates);

    res.json({ 
      message: 'File uploaded successfully', 
      accountId: accountId,
      status: 'processing'
    });

  } catch (error) {
    serviceLogger.logServiceError('PnL', 'upload', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Get P&L records summary for an account
router.get('/uploads/:accountId', async (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId);
    
    // Get records count and summary for the account
    const records = await prisma.pnLRecord.findMany({
      where: { accountId },
      select: {
        id: true,
        instrumentType: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Group by creation date to simulate uploads
    const groupedRecords = records.reduce((acc: any, record) => {
      const date = record.createdAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          date,
          records: [],
          count: 0
        };
      }
      acc[date].records.push(record);
      acc[date].count++;
      return acc;
    }, {});

    const uploads = Object.values(groupedRecords).map((group: any) => ({
      id: group.date,
      accountId,
      fileName: `PnL Records - ${group.date}`,
      uploadDate: group.date,
      status: 'completed',
      _count: { records: group.count }
    }));

    res.json(uploads);
  } catch (error) {
    serviceLogger.logServiceError('PnL', 'getUploads', error);
    res.status(500).json({ error: 'Failed to fetch uploads' });
  }
});

// Get all records for an account (across all uploads)
router.get('/account/:accountId/records', async (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId);
    
    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }

    // Get all records for the account
    const records = await prisma.pnLRecord.findMany({
      where: { accountId },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            family: true
          }
        }
      },
      orderBy: [
        { entryDate: 'desc' },
        { symbol: 'asc' }
      ]
    });

    serviceLogger.logServiceOperation('PnL', 'getAccountRecords', `Retrieved ${records.length} records for account ${accountId}`);
    res.json(records);
  } catch (error) {
    serviceLogger.logServiceError('PnL', 'getAccountRecords', error);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

// Get family-level PnL records
router.get('/family/records', async (req, res) => {
  try {
    const { familyName } = req.query;
    
    let whereClause: any = {};
    
    // If familyName is provided, filter by specific family
    if (familyName) {
      whereClause.account = {
        family: familyName as string
      };
    } else {
      // Get all families
      whereClause.account = {
        family: {
          not: null
        }
      };
    }

    // Get all PnL records with account information
    const records = await prisma.pnLRecord.findMany({
      where: whereClause,
      include: {
        account: {
          select: {
            id: true,
            name: true,
            family: true
          }
        }
      },
      orderBy: [
        { entryDate: 'desc' },
        { symbol: 'asc' }
      ]
    });

    // Group records by family and symbol
    const familyRecords = new Map<string, any>();
    
    records.forEach(record => {
      const familyKey = record.account?.family || 'Unknown';
      const symbolKey = record.symbol || record.isin || 'Unknown';
      const instrumentTypeKey = record.instrumentType;
      const key = `${familyKey}-${symbolKey}-${instrumentTypeKey}`;
      
      if (!familyRecords.has(key)) {
        familyRecords.set(key, {
          id: key,
          symbol: symbolKey,
          isin: record.isin,
          instrumentType: instrumentTypeKey,
          entryDate: record.entryDate,
          exitDate: record.exitDate,
          quantity: 0,
          buyValue: 0,
          sellValue: 0,
          profit: 0,
          periodOfHolding: record.periodOfHolding,
          fairMarketValue: 0,
          taxableProfit: 0,
          turnover: 0,
          brokerage: 0,
          exchangeTransactionCharges: 0,
          ipft: 0,
          sebiCharges: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          stampDuty: 0,
          stt: 0,
          family: familyKey,
          accountIds: [],
          accounts: [],
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        });
      }
      
      const familyRecord = familyRecords.get(key)!;
      
      // Aggregate values
      familyRecord.quantity += record.quantity || 0;
      familyRecord.buyValue += record.buyValue || 0;
      familyRecord.sellValue += record.sellValue || 0;
      familyRecord.profit += record.profit || 0;
      familyRecord.fairMarketValue += record.fairMarketValue || 0;
      familyRecord.taxableProfit += record.taxableProfit || 0;
      familyRecord.turnover += record.turnover || 0;
      familyRecord.brokerage += record.brokerage || 0;
      familyRecord.exchangeTransactionCharges += record.exchangeTransactionCharges || 0;
      familyRecord.ipft += record.ipft || 0;
      familyRecord.sebiCharges += record.sebiCharges || 0;
      familyRecord.cgst += record.cgst || 0;
      familyRecord.sgst += record.sgst || 0;
      familyRecord.igst += record.igst || 0;
      familyRecord.stampDuty += record.stampDuty || 0;
      familyRecord.stt += record.stt || 0;
      
      // Add account information
      if (record.account) {
        familyRecord.accountIds.push(record.account.id);
        familyRecord.accounts.push({
          id: record.account.id,
          name: record.account.name,
          family: record.account.family,
        });
      }
    });

    // Convert to array and remove duplicates from accountIds and accounts
    const aggregatedRecords = Array.from(familyRecords.values()).map(record => ({
      ...record,
      accountIds: [...new Set(record.accountIds)],
      accounts: record.accounts.filter((account: any, index: number, self: any[]) => 
        index === self.findIndex((a: any) => a.id === account.id)
      ),
    }));

    serviceLogger.logServiceOperation('PnL', 'getFamilyRecords', `Retrieved ${aggregatedRecords.length} family-level records`);
    res.json(aggregatedRecords);
  } catch (error) {
    serviceLogger.logServiceError('PnL', 'getFamilyRecords', error);
    res.status(500).json({ error: 'Failed to fetch family records' });
  }
});

// Get family-level PnL summary
router.get('/family/summary', async (req, res) => {
  try {
    const { familyName } = req.query;
    
    let whereClause: any = {};
    
    // If familyName is provided, filter by specific family
    if (familyName) {
      whereClause.account = {
        family: familyName as string
      };
    } else {
      // Get all families
      whereClause.account = {
        family: {
          not: null
        }
      };
    }

    // Get summary grouped by instrument type and family
    const summary = await prisma.pnLRecord.groupBy({
      by: ['instrumentType'],
      where: whereClause,
      _sum: {
        profit: true,
        buyValue: true,
        sellValue: true,
        quantity: true,
        brokerage: true,
        stt: true,
        exchangeTransactionCharges: true,
        ipft: true,
        sebiCharges: true,
        cgst: true,
        sgst: true,
        igst: true,
        stampDuty: true,
        fairMarketValue: true,
        taxableProfit: true,
        turnover: true,
      },
      _count: {
        id: true
      }
    });

    res.json(summary);
  } catch (error) {
    serviceLogger.logServiceError('PnL', 'getFamilySummary', error);
    res.status(500).json({ error: 'Failed to fetch family summary' });
  }
});

// Get records by upload ID and instrument type
router.get('/records/:accountId/:instrumentType', async (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId);
    const instrumentType = req.params.instrumentType;

    const records = await prisma.pnLRecord.findMany({
      where: {
        accountId: accountId,
        instrumentType: instrumentType
      },
      orderBy: { entryDate: 'desc' }
    });

    res.json(records);
  } catch (error) {
    serviceLogger.logServiceError('PnL', 'getRecords', error);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

// Get summary by instrument type for an account
router.get('/summary/:accountId', async (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId);

    const summary = await prisma.pnLRecord.groupBy({
      by: ['instrumentType'],
      where: { accountId },
      _sum: {
        profit: true,
        buyValue: true,
        sellValue: true,
        quantity: true,
        brokerage: true,
        stt: true
      },
      _count: {
        id: true
      }
    });

    res.json(summary);
  } catch (error) {
    serviceLogger.logServiceError('PnL', 'getSummary', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// Check for potential duplicates before upload
router.post('/check-duplicates/:accountId', async (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId);
    const { records } = req.body; // Array of records to check

    if (!records || !Array.isArray(records)) {
      return res.status(400).json({ error: 'Records array is required' });
    }

    // Get all existing records for this account
    const existingRecords = await prisma.pnLRecord.findMany({
      where: { accountId },
      select: {
        symbol: true,
        instrumentType: true,
        entryDate: true,
        exitDate: true,
        quantity: true,
        buyValue: true,
        sellValue: true,
        profit: true
      }
    });

    // Check for duplicates
    const duplicates = records.filter(record => {
      return existingRecords.some(existing => 
        existing.symbol === record.symbol &&
        existing.instrumentType === record.instrumentType &&
        existing.entryDate?.getTime() === record.entryDate?.getTime() &&
        existing.exitDate?.getTime() === record.exitDate?.getTime() &&
        existing.quantity === record.quantity &&
        existing.buyValue === record.buyValue &&
        existing.sellValue === record.sellValue &&
        existing.profit === record.profit
      );
    });

    res.json({
      duplicates,
      totalRecords: records.length,
      duplicateCount: duplicates.length
    });

  } catch (error) {
    serviceLogger.logServiceError('PnL', 'checkDuplicates', error);
    res.status(500).json({ error: 'Failed to check for duplicates' });
  }
});

// Delete P&L records by date (simulating upload deletion)
router.delete('/upload/:date', async (req, res) => {
  try {
    const date = req.params.date;
    const accountId = parseInt(req.query.accountId as string);

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    // Delete records created on the specified date for the account
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);

    const deletedRecords = await prisma.pnLRecord.deleteMany({
      where: {
        accountId,
        createdAt: {
          gte: startDate,
          lt: endDate
        }
      }
    });

    res.json({ 
      message: 'Records deleted successfully',
      deletedCount: deletedRecords.count
    });
  } catch (error) {
    serviceLogger.logServiceError('PnL', 'deleteUpload', error);
    res.status(500).json({ error: 'Failed to delete records' });
  }
});

// Parse CSV file and check for duplicates before upload
router.post('/parse-and-check-duplicates/:accountId', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const accountId = parseInt(req.params.accountId);
    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    // Verify account exists
    const account = await prisma.account.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Parse the CSV file to extract records
    const parsedRecords = await parseCSVFileForDuplicates(req.file.path);
    
    // Get all existing records for this account
    const existingRecords = await prisma.pnLRecord.findMany({
      where: { accountId },
      select: {
        symbol: true,
        instrumentType: true,
        entryDate: true,
        exitDate: true,
        quantity: true,
        buyValue: true,
        sellValue: true,
        profit: true
      }
    });

    let duplicates: any[] = [];
    let totalRecords = parsedRecords.length;

    if (existingRecords.length > 0) {

      // Check for duplicates
      duplicates = parsedRecords.filter(record => {
        return existingRecords.some(existing => 
          existing.symbol === record.symbol &&
          existing.instrumentType === record.instrumentType &&
          existing.entryDate?.getTime() === record.entryDate?.getTime() &&
          existing.exitDate?.getTime() === record.exitDate?.getTime() &&
          existing.quantity === record.quantity &&
          existing.buyValue === record.buyValue &&
          existing.sellValue === record.sellValue &&
          existing.profit === record.profit
        );
      });
    }

    // Group records by instrument type
    const recordsByInstrumentType: Record<string, { total: number; duplicates: number; unique: number }> = {};
    
    parsedRecords.forEach(record => {
      const instrumentType = record.instrumentType || 'Unknown';
      if (!recordsByInstrumentType[instrumentType]) {
        recordsByInstrumentType[instrumentType] = { total: 0, duplicates: 0, unique: 0 };
      }
      recordsByInstrumentType[instrumentType].total++;
    });

    // Count duplicates by instrument type
    duplicates.forEach(duplicate => {
      const instrumentType = duplicate.instrumentType || 'Unknown';
      if (recordsByInstrumentType[instrumentType]) {
        recordsByInstrumentType[instrumentType].duplicates++;
      }
    });

    // Calculate unique records by instrument type
    Object.keys(recordsByInstrumentType).forEach(instrumentType => {
      recordsByInstrumentType[instrumentType].unique = 
        recordsByInstrumentType[instrumentType].total - recordsByInstrumentType[instrumentType].duplicates;
    });

    // Don't delete the file here - it will be deleted after actual upload
    // The file needs to remain for the actual upload step

    res.json({
      totalRecords,
      duplicateCount: duplicates.length,
      duplicates,
      uniqueRecords: totalRecords - duplicates.length,
      recordsByInstrumentType,
      parsedRecords // Include all parsed records for preview
    });

  } catch (error) {
    serviceLogger.logServiceError('PnL', 'parseAndCheckDuplicates', error);
    res.status(500).json({ error: 'Failed to parse file and check duplicates' });
  }
});

// Function to process dividend CSV file (reused from dividends.ts logic)
async function processDividendCSVFile(filePath: string, accountId: number, skipDuplicates: boolean = false) {
  try {
    const results: any[] = [];
    let headers: string[] = [];
    let isDataSection = false;
    let foundHeaderRow = false;
    let totalRecords = 0;
    let skippedRecords = 0;

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');

    serviceLogger.logServiceOperation('PnL', 'processDividendCSVFile', `Processing dividend file with ${lines.length} lines`);

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const trimmedLine = line.trim();
      
      if (!trimmedLine) continue;

      // Check if this is the dividend data section
      if (trimmedLine.includes('Equity Dividends from') || (trimmedLine.includes('Dividend') && !trimmedLine.includes('Symbol'))) {
        isDataSection = true;
        serviceLogger.logServiceOperation('PnL', 'processDividendCSVFile', `Found dividend section at line ${lineIndex + 1}: ${trimmedLine}`);
        continue;
      }

      // If we're in the data section and this line has comma-separated values
      if (isDataSection && trimmedLine && trimmedLine.includes(',')) {
        const values = trimmedLine.split(',');
        totalRecords++;

        // Check if this is the header row
        if (values.length > 1 && values[0].trim() === 'Symbol') {
          headers = values.map(h => h.trim());
          foundHeaderRow = true;
          serviceLogger.logServiceOperation('PnL', 'processDividendCSVFile', `Found header row at line ${lineIndex + 1}: ${headers.join(', ')}`);
          continue;
        }

        // Skip if we haven't found the header row yet
        if (!foundHeaderRow) {
          serviceLogger.logServiceOperation('PnL', 'processDividendCSVFile', `Skipping line ${lineIndex + 1} - no header row found yet`);
          continue;
        }

        // Skip if this is not a data row
        if (values[0].trim() === 'Total Dividend Amount' || 
            values[0].trim() === '' || 
            values[0].trim().toLowerCase().includes('total') ||
            values[0].trim().toLowerCase().includes('dividends are credited')) {
          serviceLogger.logServiceOperation('PnL', 'processDividendCSVFile', `Skipping summary row at line ${lineIndex + 1}: ${values[0].trim()}`);
          continue;
        }

        // Enhanced validation: Skip records where Symbol is empty
        const symbolValue = values[0]?.trim();
        if (!symbolValue || symbolValue === '') {
          skippedRecords++;
          serviceLogger.logServiceOperation('PnL', 'processDividendCSVFile', `Skipping empty symbol at line ${lineIndex + 1}`);
          continue;
        }

        // Additional validation: Check if this row has meaningful data
        const hasMeaningfulData = values.some((value, index) => {
          if (index === 0) return true; // Symbol is already checked
          const trimmedValue = value?.trim();
          return trimmedValue && trimmedValue !== '' && trimmedValue !== '0';
        });

        if (!hasMeaningfulData) {
          skippedRecords++;
          serviceLogger.logServiceOperation('PnL', 'processDividendCSVFile', `Skipping row with no meaningful data at line ${lineIndex + 1}`);
          continue;
        }

        // Create record object
        const record: any = {
          accountId,
        };

        // Map values to record fields
        headers.forEach((header, index) => {
          if (index < values.length) {
            const value = values[index]?.trim();
            
            switch (header) {
              case 'Symbol':
                record.symbol = value;
                break;
              case 'ISIN':
                record.isin = value;
                break;
              case 'Ex-date':
                record.exDate = value ? new Date(value) : null;
                break;
              case 'Quantity':
                record.quantity = value ? parseFloat(value) : null;
                break;
              case 'Dividend Per Share':
                record.dividendPerShare = value ? parseFloat(value) : null;
                break;
              case 'Net Dividend Amount':
                record.netDividendAmount = value ? parseFloat(value) : null;
                break;
            }
          }
        });

        // Final validation: Ensure we have at least a symbol and some meaningful data
        if (record.symbol && (record.quantity || record.dividendPerShare || record.netDividendAmount)) {
          results.push(record);
          serviceLogger.logServiceOperation('PnL', 'processDividendCSVFile', `Added record at line ${lineIndex + 1}: ${record.symbol} - Qty: ${record.quantity}, DPS: ${record.dividendPerShare}, Amount: ${record.netDividendAmount}`);
        } else {
          skippedRecords++;
          serviceLogger.logServiceOperation('PnL', 'processDividendCSVFile', `Skipping invalid record at line ${lineIndex + 1}: ${JSON.stringify(record)}`);
        }
      }
    }

    serviceLogger.logServiceOperation('PnL', 'processDividendCSVFile', `Parsed ${results.length} valid dividend records from ${totalRecords} total records (skipped ${skippedRecords} empty/invalid records)`);

    // Insert records with duplicate prevention
    if (results.length > 0) {
      let insertedCount = 0;
      let skippedCount = 0;
      
      if (skipDuplicates) {
        // Get existing records to filter out duplicates before insertion
        const existingRecords = await prisma.dividendRecord.findMany({
          where: { accountId },
          select: {
            symbol: true,
            isin: true,
            exDate: true,
            quantity: true,
            dividendPerShare: true,
            netDividendAmount: true
          }
        });

        if (existingRecords.length > 0) {
          // Filter out duplicates
          const uniqueRecords = results.filter(record => {
            return !existingRecords.some(existing => 
              existing.symbol === record.symbol &&
              existing.isin === record.isin &&
              existing.exDate?.getTime() === record.exDate?.getTime() &&
              existing.quantity === record.quantity &&
              existing.dividendPerShare === record.dividendPerShare &&
              existing.netDividendAmount === record.netDividendAmount
            );
          });

          skippedCount = results.length - uniqueRecords.length;
          
          // Insert only unique records
          if (uniqueRecords.length > 0) {
            await prisma.dividendRecord.createMany({
              data: uniqueRecords
            });
            insertedCount = uniqueRecords.length;
          }
        } else {
          // No existing records, insert all
          await prisma.dividendRecord.createMany({
            data: results
          });
          insertedCount = results.length;
        }
      } else {
        // Original duplicate prevention logic
        for (const record of results) {
          try {
            await prisma.dividendRecord.create({
              data: record
            });
            insertedCount++;
          } catch (error: any) {
            // Check if this is a unique constraint violation (duplicate)
            if (error.code === 'P2002' && error.meta?.target?.includes('unique_dividend_record')) {
              skippedCount++;
              serviceLogger.logServiceOperation('PnL', 'processDividendCSVFile', `Skipped duplicate record: ${record.symbol} - ${record.exDate}`);
            } else {
              // Re-throw if it's not a duplicate error
              throw error;
            }
          }
        }
      }
      
      serviceLogger.logServiceOperation('PnL', 'processDividendCSVFile', `Inserted ${insertedCount} new records, skipped ${skippedCount} duplicates`);
    } else {
      serviceLogger.logServiceOperation('PnL', 'processDividendCSVFile', `No valid records found to insert`);
    }

    // Clean up the uploaded file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    serviceLogger.logServiceOperation('PnL', 'processDividendCSVFile', `Successfully processed dividend CSV file with ${results.length} records`);
  } catch (error) {
    serviceLogger.logServiceError('PnL', 'processDividendCSVFile', error);
    
    // Clean up the uploaded file even if processing failed
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (cleanupError) {
      serviceLogger.logServiceError('PnL', 'dividendFileCleanup', cleanupError);
    }
  }
}

// Function to process CSV file
async function processCSVFile(filePath: string, accountId: number, skipDuplicates: boolean = false) {
  try {
    // Check if this is a dividend file
    if (isDividendFile(filePath)) {
      serviceLogger.logServiceOperation('PnL', 'processCSVFile', `Detected dividend file, routing to dividend processor`);
      return await processDividendCSVFile(filePath, accountId, skipDuplicates);
    }

    // Otherwise, use P&L processor
    const results: any[] = [];
    let currentInstrumentType = '';
    let isHeaderRow = false;
    let headers: string[] = [];
    let skippedRecords = 0;
    let totalRecords = 0;

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      const instrumentTypes = [
        'Equity - Intraday',
        'Equity - Short Term',
        'Equity - Long Term',
        'Equity - Buyback',
        'Non Equity',
        'Mutual Funds',
        'F&O',
        'Currency',
        'Commodity'
      ];

      if (instrumentTypes.some(type => trimmedLine.startsWith(type))) {
        currentInstrumentType = trimmedLine.split(',')[0]; // Get just the instrument type without trailing commas
        isHeaderRow = true;
        continue;
      }

      // If this is a data row (not empty and has comma-separated values)
      if (trimmedLine && trimmedLine.includes(',') && currentInstrumentType) {
        const values = trimmedLine.split(',');
        totalRecords++;
        
        if (isHeaderRow) {
          // Skip empty header rows and find the actual header row
          if (values.length > 1 && values[0].trim() === 'Symbol') {
            headers = values.map(h => h.trim());
            isHeaderRow = false;
            console.log('Found headers:', headers);
          }
          continue;
        }

        // Skip records where Symbol is empty or contains only whitespace
        const symbolIndex = headers.findIndex(h => h === 'Symbol');
        if (symbolIndex >= 0 && symbolIndex < values.length) {
          const symbolValue = values[symbolIndex]?.trim();
          if (!symbolValue || symbolValue === '') {
            skippedRecords++;
            continue; // Skip this record
          }
        }

        // Create record object
        const record: any = {
          accountId,
          instrumentType: currentInstrumentType
        };

        console.log(`Processing record for ${currentInstrumentType}:`, values.slice(0, 5));

        // Map CSV columns to database fields
        headers.forEach((header, index) => {
          const value = values[index]?.trim();
          if (value && value !== '') {
            switch (header) {
              case 'Symbol':
                record.symbol = value;
                break;
              case 'ISIN':
                record.isin = value;
                break;
              case 'Entry Date':
                record.entryDate = value ? new Date(value) : null;
                break;
              case 'Exit Date':
                record.exitDate = value ? new Date(value) : null;
                break;
              case 'Quantity':
                record.quantity = value ? parseFloat(value) : null;
                break;
              case 'Buy Value':
                record.buyValue = value ? parseFloat(value) : null;
                break;
              case 'Sell Value':
                record.sellValue = value ? parseFloat(value) : null;
                break;
              case 'Profit':
                record.profit = value ? parseFloat(value) : null;
                break;
              case 'Period of Holding':
                record.periodOfHolding = value;
                break;
              case 'Fair Market Value':
                record.fairMarketValue = value ? parseFloat(value) : null;
                break;
              case 'Taxable Profit':
                record.taxableProfit = value ? parseFloat(value) : null;
                break;
              case 'Turnover':
                record.turnover = value ? parseFloat(value) : null;
                break;
              case 'Brokerage':
                record.brokerage = value ? parseFloat(value) : null;
                break;
              case 'Exchange Transaction Charges':
                record.exchangeTransactionCharges = value ? parseFloat(value) : null;
                break;
              case 'IPFT':
                record.ipft = value ? parseFloat(value) : null;
                break;
              case 'SEBI Charges':
                record.sebiCharges = value ? parseFloat(value) : null;
                break;
              case 'CGST':
                record.cgst = value ? parseFloat(value) : null;
                break;
              case 'SGST':
                record.sgst = value ? parseFloat(value) : null;
                break;
              case 'IGST':
                record.igst = value ? parseFloat(value) : null;
                break;
              case 'Stamp Duty':
                record.stampDuty = value ? parseFloat(value) : null;
                break;
              case 'STT':
                record.stt = value ? parseFloat(value) : null;
                break;
            }
          }
        });

        results.push(record);
      }
    }

    serviceLogger.logServiceOperation('PnL', 'processCSVFile', `Parsed ${results.length} valid records from ${totalRecords} total records (skipped ${skippedRecords} records with empty symbols)`);

        let insertedCount = 0;
        let skippedCount = 0;
        
    try {
      // Insert all records into database - simplified approach
      if (results.length > 0) {
        // Create clean records with only the fields we need (explicitly exclude id, createdAt, updatedAt)
        const recordsToInsert = results.map(record => {
          const cleanRecord: any = {};
          if (record.accountId !== undefined) cleanRecord.accountId = record.accountId;
          if (record.instrumentType !== undefined) cleanRecord.instrumentType = record.instrumentType;
          if (record.symbol !== undefined) cleanRecord.symbol = record.symbol;
          if (record.isin !== undefined) cleanRecord.isin = record.isin;
          if (record.entryDate !== undefined) cleanRecord.entryDate = record.entryDate;
          if (record.exitDate !== undefined) cleanRecord.exitDate = record.exitDate;
          if (record.quantity !== undefined) cleanRecord.quantity = record.quantity;
          if (record.buyValue !== undefined) cleanRecord.buyValue = record.buyValue;
          if (record.sellValue !== undefined) cleanRecord.sellValue = record.sellValue;
          if (record.profit !== undefined) cleanRecord.profit = record.profit;
          if (record.periodOfHolding !== undefined) cleanRecord.periodOfHolding = record.periodOfHolding;
          if (record.fairMarketValue !== undefined) cleanRecord.fairMarketValue = record.fairMarketValue;
          if (record.taxableProfit !== undefined) cleanRecord.taxableProfit = record.taxableProfit;
          if (record.turnover !== undefined) cleanRecord.turnover = record.turnover;
          if (record.brokerage !== undefined) cleanRecord.brokerage = record.brokerage;
          if (record.exchangeTransactionCharges !== undefined) cleanRecord.exchangeTransactionCharges = record.exchangeTransactionCharges;
          if (record.ipft !== undefined) cleanRecord.ipft = record.ipft;
          if (record.sebiCharges !== undefined) cleanRecord.sebiCharges = record.sebiCharges;
          if (record.cgst !== undefined) cleanRecord.cgst = record.cgst;
          if (record.sgst !== undefined) cleanRecord.sgst = record.sgst;
          if (record.igst !== undefined) cleanRecord.igst = record.igst;
          if (record.stampDuty !== undefined) cleanRecord.stampDuty = record.stampDuty;
          if (record.stt !== undefined) cleanRecord.stt = record.stt;
          return cleanRecord;
        });
        
        serviceLogger.logServiceOperation('PnL', 'processCSVFile', `Attempting to insert ${recordsToInsert.length} records directly (no pre-filtering)`);
        if (recordsToInsert.length > 0) {
          serviceLogger.logServiceOperation('PnL', 'processCSVFile', `Sample record structure: ${JSON.stringify(recordsToInsert[0])}`);
        }
        
        // Insert records one by one - this is the most reliable approach
        for (let idx = 0; idx < recordsToInsert.length; idx++) {
          const cleanRecord = recordsToInsert[idx];
          try {
            await prisma.pnLRecord.create({
              data: cleanRecord
            });
            insertedCount++;
            if ((idx + 1) % 50 === 0) {
              serviceLogger.logServiceOperation('PnL', 'processCSVFile', `Progress: Inserted ${insertedCount} out of ${idx + 1} records processed`);
            }
          } catch (individualError: any) {
            // Check if this is a unique constraint violation (duplicate)
            if (individualError.code === 'P2002') {
              skippedCount++;
              if (skippedCount <= 10) {
                serviceLogger.logServiceOperation('PnL', 'processCSVFile', `Duplicate (P2002) - Record ${idx + 1}: ${cleanRecord.symbol || 'N/A'} - ${cleanRecord.instrumentType || 'N/A'}, Error target: ${JSON.stringify(individualError.meta?.target || [])}`);
              }
            } else {
              // Log other errors but continue processing
              serviceLogger.logServiceError('PnL', 'processCSVFile', individualError);
              serviceLogger.logServiceOperation('PnL', 'processCSVFile', `Failed to insert record ${idx + 1}: ${individualError.code} - ${individualError.message}`);
              skippedCount++;
            }
          }
        }
        
        serviceLogger.logServiceOperation('PnL', 'processCSVFile', `Inserted ${insertedCount} records, skipped ${skippedCount} duplicates/errors`);
        
        /* REMOVED COMPLEX LOGIC - keeping for reference
        if (skipDuplicates) {
          // Get existing records to filter out duplicates before insertion
          const existingRecords = await prisma.pnLRecord.findMany({
            where: { accountId },
            select: {
              symbol: true,
              instrumentType: true,
              entryDate: true,
              exitDate: true,
              quantity: true,
              buyValue: true,
              sellValue: true,
              profit: true
            }
          });

          if (existingRecords.length > 0) {
            // Filter out duplicates
            // Normalize dates to compare only the date part (ignore time)
            const normalizeDate = (date: Date | null | undefined): string | null => {
              if (!date) return null;
              const d = new Date(date);
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            };
            
            // Helper to compare floating point numbers with tolerance
            const floatEquals = (a: number | null | undefined, b: number | null | undefined, tolerance: number = 0.01): boolean => {
              if (a === null || a === undefined) return b === null || b === undefined;
              if (b === null || b === undefined) return false;
              return Math.abs(a - b) < tolerance;
            };
            
            const uniqueRecords = results.filter(record => {
              return !existingRecords.some(existing => {
                const symbolMatch = existing.symbol === record.symbol;
                const instrumentTypeMatch = existing.instrumentType === record.instrumentType;
                const entryDateMatch = normalizeDate(existing.entryDate) === normalizeDate(record.entryDate);
                const exitDateMatch = normalizeDate(existing.exitDate) === normalizeDate(record.exitDate);
                const quantityMatch = floatEquals(existing.quantity, record.quantity);
                const buyValueMatch = floatEquals(existing.buyValue, record.buyValue);
                const sellValueMatch = floatEquals(existing.sellValue, record.sellValue);
                const profitMatch = floatEquals(existing.profit, record.profit);
                
                if (symbolMatch && instrumentTypeMatch && entryDateMatch && exitDateMatch && 
                    quantityMatch && buyValueMatch && sellValueMatch && profitMatch) {
                  // Log first few matches to debug
                  if (Math.random() < 0.1) { // Log ~10% of matches
                    serviceLogger.logServiceOperation('PnL', 'processCSVFile', `Found duplicate: ${record.symbol} - ${record.instrumentType}, Entry: ${normalizeDate(record.entryDate)}, Exit: ${normalizeDate(record.exitDate)}`);
                  }
                  return true;
                }
                return false;
              });
            });

            skippedCount = results.length - uniqueRecords.length;
            
            // Insert only unique records
            if (uniqueRecords.length > 0) {
              // Create clean records with only the fields we need (explicitly exclude id, createdAt, updatedAt)
              const recordsToInsert = uniqueRecords.map(record => {
                // Explicitly create a new object with only the fields we want
                const cleanRecord: any = {};
                if (record.accountId !== undefined) cleanRecord.accountId = record.accountId;
                if (record.instrumentType !== undefined) cleanRecord.instrumentType = record.instrumentType;
                if (record.symbol !== undefined) cleanRecord.symbol = record.symbol;
                if (record.isin !== undefined) cleanRecord.isin = record.isin;
                if (record.entryDate !== undefined) cleanRecord.entryDate = record.entryDate;
                if (record.exitDate !== undefined) cleanRecord.exitDate = record.exitDate;
                if (record.quantity !== undefined) cleanRecord.quantity = record.quantity;
                if (record.buyValue !== undefined) cleanRecord.buyValue = record.buyValue;
                if (record.sellValue !== undefined) cleanRecord.sellValue = record.sellValue;
                if (record.profit !== undefined) cleanRecord.profit = record.profit;
                if (record.periodOfHolding !== undefined) cleanRecord.periodOfHolding = record.periodOfHolding;
                if (record.fairMarketValue !== undefined) cleanRecord.fairMarketValue = record.fairMarketValue;
                if (record.taxableProfit !== undefined) cleanRecord.taxableProfit = record.taxableProfit;
                if (record.turnover !== undefined) cleanRecord.turnover = record.turnover;
                if (record.brokerage !== undefined) cleanRecord.brokerage = record.brokerage;
                if (record.exchangeTransactionCharges !== undefined) cleanRecord.exchangeTransactionCharges = record.exchangeTransactionCharges;
                if (record.ipft !== undefined) cleanRecord.ipft = record.ipft;
                if (record.sebiCharges !== undefined) cleanRecord.sebiCharges = record.sebiCharges;
                if (record.cgst !== undefined) cleanRecord.cgst = record.cgst;
                if (record.sgst !== undefined) cleanRecord.sgst = record.sgst;
                if (record.igst !== undefined) cleanRecord.igst = record.igst;
                if (record.stampDuty !== undefined) cleanRecord.stampDuty = record.stampDuty;
                if (record.stt !== undefined) cleanRecord.stt = record.stt;
                return cleanRecord;
              });
              
              // Insert records one by one to get better error reporting and ensure all valid records are inserted
              serviceLogger.logServiceOperation('PnL', 'processCSVFile', `Attempting to insert ${recordsToInsert.length} unique records`);
              if (recordsToInsert.length > 0) {
                serviceLogger.logServiceOperation('PnL', 'processCSVFile', `Sample record structure: ${JSON.stringify(recordsToInsert[0])}`);
              }
              
              let successCount = 0;
              let duplicateErrorCount = 0;
              let otherErrorCount = 0;
              
              // Create clean records array for batch insert
              const cleanRecordsForInsert: any[] = [];
              
              for (let idx = 0; idx < recordsToInsert.length; idx++) {
                const record = recordsToInsert[idx];
                // Explicitly create a new object with only the fields we want - don't use destructuring
                const cleanRecord: any = {};
                if (record.accountId !== undefined) cleanRecord.accountId = record.accountId;
                if (record.instrumentType !== undefined) cleanRecord.instrumentType = record.instrumentType;
                if (record.symbol !== undefined) cleanRecord.symbol = record.symbol;
                if (record.isin !== undefined) cleanRecord.isin = record.isin;
                if (record.entryDate !== undefined) cleanRecord.entryDate = record.entryDate;
                if (record.exitDate !== undefined) cleanRecord.exitDate = record.exitDate;
                if (record.quantity !== undefined) cleanRecord.quantity = record.quantity;
                if (record.buyValue !== undefined) cleanRecord.buyValue = record.buyValue;
                if (record.sellValue !== undefined) cleanRecord.sellValue = record.sellValue;
                if (record.profit !== undefined) cleanRecord.profit = record.profit;
                if (record.periodOfHolding !== undefined) cleanRecord.periodOfHolding = record.periodOfHolding;
                if (record.fairMarketValue !== undefined) cleanRecord.fairMarketValue = record.fairMarketValue;
                if (record.taxableProfit !== undefined) cleanRecord.taxableProfit = record.taxableProfit;
                if (record.turnover !== undefined) cleanRecord.turnover = record.turnover;
                if (record.brokerage !== undefined) cleanRecord.brokerage = record.brokerage;
                if (record.exchangeTransactionCharges !== undefined) cleanRecord.exchangeTransactionCharges = record.exchangeTransactionCharges;
                if (record.ipft !== undefined) cleanRecord.ipft = record.ipft;
                if (record.sebiCharges !== undefined) cleanRecord.sebiCharges = record.sebiCharges;
                if (record.cgst !== undefined) cleanRecord.cgst = record.cgst;
                if (record.sgst !== undefined) cleanRecord.sgst = record.sgst;
                if (record.igst !== undefined) cleanRecord.igst = record.igst;
                if (record.stampDuty !== undefined) cleanRecord.stampDuty = record.stampDuty;
                if (record.stt !== undefined) cleanRecord.stt = record.stt;
                
                // Verify no id field is present
                if ('id' in cleanRecord || 'createdAt' in cleanRecord || 'updatedAt' in cleanRecord) {
                  serviceLogger.logServiceOperation('PnL', 'processCSVFile', `ERROR: Found forbidden fields in cleanRecord: ${Object.keys(cleanRecord).join(', ')}`);
                  delete cleanRecord.id;
                  delete cleanRecord.createdAt;
                  delete cleanRecord.updatedAt;
                }
                
                // Collect records for batch insert
                cleanRecordsForInsert.push(cleanRecord);
              }
              
              // Insert all records in a single batch using createMany with skipDuplicates
              // NOTE: skipDuplicates only works if there's a unique constraint in the database
              // If there's no unique constraint, createMany will return 0 inserted without error
              // So we need to check the result and fall back to individual inserts if needed
              if (cleanRecordsForInsert.length > 0) {
                try {
                  const batchResult = await prisma.pnLRecord.createMany({
                    data: cleanRecordsForInsert,
                    skipDuplicates: true
                  });
                  
                  // If batch insert returned 0, it means either:
                  // 1. All records were duplicates (if unique constraint exists)
                  // 2. No unique constraint exists, so skipDuplicates can't work
                  // In either case, fall back to individual inserts to get proper error handling
                  if (batchResult.count === 0) {
                    serviceLogger.logServiceOperation('PnL', 'processCSVFile', `Batch insert returned 0 (likely no unique constraint or all duplicates), falling back to individual inserts`);
                    
                    // Fall through to individual insert logic below
                  } else {
                    insertedCount = batchResult.count;
                    successCount = batchResult.count;
                    skippedCount += cleanRecordsForInsert.length - batchResult.count;
                    serviceLogger.logServiceOperation('PnL', 'processCSVFile', `Batch insert: ${batchResult.count} inserted out of ${cleanRecordsForInsert.length} attempted`);
                  }
                } catch (batchError: any) {
                  // If batch fails with an error, log it and fall back to individual inserts
                  serviceLogger.logServiceError('PnL', 'processCSVFile', batchError);
                  serviceLogger.logServiceOperation('PnL', 'processCSVFile', `Batch insert failed, trying individual inserts`);
                }
                
                // If batch insert returned 0 or threw an error, insert one by one
                if (insertedCount === 0 && successCount === 0) {
                  for (let idx = 0; idx < cleanRecordsForInsert.length; idx++) {
                    const cleanRecord = cleanRecordsForInsert[idx];
                    try {
                      await prisma.pnLRecord.create({
                        data: cleanRecord
                      });
                      insertedCount++;
                      successCount++;
                      if ((idx + 1) % 50 === 0) {
                        serviceLogger.logServiceOperation('PnL', 'processCSVFile', `Progress: Inserted ${insertedCount} out of ${idx + 1} records processed`);
                      }
                    } catch (individualError: any) {
                      // Check if this is a unique constraint violation (duplicate)
                      if (individualError.code === 'P2002') {
                        duplicateErrorCount++;
                        skippedCount++;
                        if (duplicateErrorCount <= 5) {
                          serviceLogger.logServiceOperation('PnL', 'processCSVFile', `Duplicate (P2002) - Record ${idx + 1}: ${cleanRecord.symbol || 'N/A'} - ${cleanRecord.instrumentType || 'N/A'}`);
                        }
                      } else {
                        otherErrorCount++;
                        serviceLogger.logServiceError('PnL', 'processCSVFile', individualError);
                        skippedCount++;
                      }
                    }
                  }
                }
              }
              
              serviceLogger.logServiceOperation('PnL', 'processCSVFile', `Insertion summary: ${successCount} succeeded, ${duplicateErrorCount} duplicates (P2002), ${otherErrorCount} other errors`);
              serviceLogger.logServiceOperation('PnL', 'processCSVFile', `Inserted ${insertedCount} unique records out of ${uniqueRecords.length} attempted`);
            } else {
              serviceLogger.logServiceOperation('PnL', 'processCSVFile', `No unique records to insert (all ${results.length} records were duplicates)`);
            }
          } else {
            // No existing records, insert all
            // Create clean records with only the fields we need (explicitly exclude id, createdAt, updatedAt)
            const recordsToInsert = results.map(record => {
              // Explicitly create a new object with only the fields we want
              const cleanRecord: any = {};
              if (record.accountId !== undefined) cleanRecord.accountId = record.accountId;
              if (record.instrumentType !== undefined) cleanRecord.instrumentType = record.instrumentType;
              if (record.symbol !== undefined) cleanRecord.symbol = record.symbol;
              if (record.isin !== undefined) cleanRecord.isin = record.isin;
              if (record.entryDate !== undefined) cleanRecord.entryDate = record.entryDate;
              if (record.exitDate !== undefined) cleanRecord.exitDate = record.exitDate;
              if (record.quantity !== undefined) cleanRecord.quantity = record.quantity;
              if (record.buyValue !== undefined) cleanRecord.buyValue = record.buyValue;
              if (record.sellValue !== undefined) cleanRecord.sellValue = record.sellValue;
              if (record.profit !== undefined) cleanRecord.profit = record.profit;
              if (record.periodOfHolding !== undefined) cleanRecord.periodOfHolding = record.periodOfHolding;
              if (record.fairMarketValue !== undefined) cleanRecord.fairMarketValue = record.fairMarketValue;
              if (record.taxableProfit !== undefined) cleanRecord.taxableProfit = record.taxableProfit;
              if (record.turnover !== undefined) cleanRecord.turnover = record.turnover;
              if (record.brokerage !== undefined) cleanRecord.brokerage = record.brokerage;
              if (record.exchangeTransactionCharges !== undefined) cleanRecord.exchangeTransactionCharges = record.exchangeTransactionCharges;
              if (record.ipft !== undefined) cleanRecord.ipft = record.ipft;
              if (record.sebiCharges !== undefined) cleanRecord.sebiCharges = record.sebiCharges;
              if (record.cgst !== undefined) cleanRecord.cgst = record.cgst;
              if (record.sgst !== undefined) cleanRecord.sgst = record.sgst;
              if (record.igst !== undefined) cleanRecord.igst = record.igst;
              if (record.stampDuty !== undefined) cleanRecord.stampDuty = record.stampDuty;
              if (record.stt !== undefined) cleanRecord.stt = record.stt;
              return cleanRecord;
            });
            
            // Insert records one by one to get better error reporting and ensure all valid records are inserted
            for (const record of recordsToInsert) {
              try {
                await prisma.pnLRecord.create({
                  data: record
                });
                insertedCount++;
              } catch (individualError: any) {
                // Check if this is a unique constraint violation (duplicate)
                if (individualError.code === 'P2002') {
                  skippedCount++;
                  serviceLogger.logServiceOperation('PnL', 'processCSVFile', `Skipped duplicate record: ${record.symbol || 'N/A'} - ${record.instrumentType || 'N/A'}`);
                } else {
                  // Log other errors but continue processing
                  serviceLogger.logServiceError('PnL', 'processCSVFile', individualError);
                  serviceLogger.logServiceOperation('PnL', 'processCSVFile', `Failed to insert record: ${JSON.stringify(record).substring(0, 200)}`);
                  skippedCount++;
                }
              }
            }
            serviceLogger.logServiceOperation('PnL', 'processCSVFile', `Inserted ${insertedCount} records (no existing records found)`);
          }
        } else {
          // Original duplicate prevention logic
          for (const record of results) {
            try {
              // Create clean record with only the fields we need (explicitly exclude id, createdAt, updatedAt)
              const cleanRecord = {
                accountId: record.accountId,
                instrumentType: record.instrumentType,
                symbol: record.symbol,
                isin: record.isin,
                entryDate: record.entryDate,
                exitDate: record.exitDate,
                quantity: record.quantity,
                buyValue: record.buyValue,
                sellValue: record.sellValue,
                profit: record.profit,
                periodOfHolding: record.periodOfHolding,
                fairMarketValue: record.fairMarketValue,
                taxableProfit: record.taxableProfit,
                turnover: record.turnover,
                brokerage: record.brokerage,
                exchangeTransactionCharges: record.exchangeTransactionCharges,
                ipft: record.ipft,
                sebiCharges: record.sebiCharges,
                cgst: record.cgst,
                sgst: record.sgst,
                igst: record.igst,
                stampDuty: record.stampDuty,
                stt: record.stt
              };
              
              await prisma.pnLRecord.create({
                data: cleanRecord
              });
              insertedCount++;
            } catch (error: any) {
              // Check if this is a unique constraint violation (duplicate)
              if (error.code === 'P2002' && error.meta?.target?.includes('unique_pnl_record')) {
                skippedCount++;
                serviceLogger.logServiceOperation('PnL', 'processCSVFile', `Skipped duplicate record: ${record.symbol} - ${record.instrumentType}`);
              } else {
                // Re-throw if it's not a duplicate error
                throw error;
              }
            }
          }
        }
        */
      }

      // Clean up the uploaded file
      if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      }

      serviceLogger.logServiceOperation('PnL', 'processCSVFile', `Successfully processed CSV file with ${results.length} records, inserted ${insertedCount}, skipped ${skippedCount}`);
    } catch (dbError) {
      serviceLogger.logServiceError('PnL', 'saveRecords', dbError);
      // Try to clean up the file even if there was an error
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (cleanupError) {
        serviceLogger.logServiceError('PnL', 'cleanupAfterError', cleanupError);
      }
    }

  } catch (error) {
    serviceLogger.logServiceError('PnL', 'processCSVFile', error);
  }
}

// Helper function to detect if a CSV file is a dividend file
function isDividendFile(filePath: string): boolean {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');
    
    // Check first 50 lines for dividend indicators
    for (let i = 0; i < Math.min(50, lines.length); i++) {
      const trimmedLine = lines[i].trim();
      
      // Check for dividend section markers
      if (trimmedLine.includes('Equity Dividends from') || 
          (trimmedLine.includes('Dividend') && trimmedLine.includes('Per Share')) ||
          trimmedLine.includes('Dividend Per Share')) {
        return true;
      }
      
      // Check for dividend header row
      if (trimmedLine.includes('Symbol') && trimmedLine.includes('Dividend Per Share')) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    serviceLogger.logServiceError('PnL', 'isDividendFile', error);
    return false;
  }
}

// Function to parse dividend CSV file for duplicate checking (reused from dividends.ts logic)
async function parseDividendCSVFileForDuplicates(filePath: string): Promise<any[]> {
  try {
    const results: any[] = [];
    let headers: string[] = [];
    let isDataSection = false;
    let foundHeaderRow = false;
    let totalRecords = 0;
    let skippedRecords = 0;

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');

    serviceLogger.logServiceOperation('PnL', 'parseDividendCSVFileForDuplicates', `Processing dividend file with ${lines.length} lines`);

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const trimmedLine = line.trim();
      
      if (!trimmedLine) continue;

      // Check if this is the dividend data section
      if (trimmedLine.includes('Equity Dividends from') || (trimmedLine.includes('Dividend') && !trimmedLine.includes('Symbol'))) {
        isDataSection = true;
        serviceLogger.logServiceOperation('PnL', 'parseDividendCSVFileForDuplicates', `Found dividend section at line ${lineIndex + 1}: ${trimmedLine}`);
        continue;
      }

      // If we're in the data section and this line has comma-separated values
      if (isDataSection && trimmedLine && trimmedLine.includes(',')) {
        const values = trimmedLine.split(',');
        totalRecords++;

        // Check if this is the header row
        if (values.length > 1 && values[0].trim() === 'Symbol') {
          headers = values.map(h => h.trim());
          foundHeaderRow = true;
          serviceLogger.logServiceOperation('PnL', 'parseDividendCSVFileForDuplicates', `Found header row at line ${lineIndex + 1}: ${headers.join(', ')}`);
          continue;
        }

        // Skip if we haven't found the header row yet
        if (!foundHeaderRow) {
          continue;
        }

        // Skip if this is not a data row
        if (values[0].trim() === 'Total Dividend Amount' || 
            values[0].trim() === '' || 
            values[0].trim().toLowerCase().includes('total') ||
            values[0].trim().toLowerCase().includes('dividends are credited')) {
          continue;
        }

        // Skip records where Symbol is empty
        const symbolValue = values[0]?.trim();
        if (!symbolValue || symbolValue === '') {
          skippedRecords++;
          continue;
        }

        // Additional validation: Check if this row has meaningful data
        const hasMeaningfulData = values.some((value, index) => {
          if (index === 0) return true; // Symbol is already checked
          const trimmedValue = value?.trim();
          return trimmedValue && trimmedValue !== '' && trimmedValue !== '0';
        });

        if (!hasMeaningfulData) {
          skippedRecords++;
          continue;
        }

        // Create record object
        const record: any = {};

        // Map values to record fields
        headers.forEach((header, index) => {
          if (index < values.length) {
            const value = values[index]?.trim();
            
            switch (header) {
              case 'Symbol':
                record.symbol = value;
                break;
              case 'ISIN':
                record.isin = value;
                break;
              case 'Ex-date':
                record.exDate = value ? new Date(value) : null;
                break;
              case 'Quantity':
                record.quantity = value ? parseFloat(value) : null;
                break;
              case 'Dividend Per Share':
                record.dividendPerShare = value ? parseFloat(value) : null;
                break;
              case 'Net Dividend Amount':
                record.netDividendAmount = value ? parseFloat(value) : null;
                break;
            }
          }
        });

        // Final validation: Ensure we have at least a symbol and some meaningful data
        if (record.symbol && (record.quantity || record.dividendPerShare || record.netDividendAmount)) {
          results.push(record);
        } else {
          skippedRecords++;
        }
      }
    }

    serviceLogger.logServiceOperation('PnL', 'parseDividendCSVFileForDuplicates', `Parsed ${results.length} valid dividend records from ${totalRecords} total records (skipped ${skippedRecords} empty/invalid records)`);
    return results;

  } catch (error) {
    serviceLogger.logServiceError('PnL', 'parseDividendCSVFileForDuplicates', error);
    throw error;
  }
}

// Function to parse CSV file for duplicate checking (without saving to database)
async function parseCSVFileForDuplicates(filePath: string): Promise<any[]> {
  try {
    // Check if this is a dividend file
    if (isDividendFile(filePath)) {
      serviceLogger.logServiceOperation('PnL', 'parseCSVFileForDuplicates', `Detected dividend file, using dividend parser`);
      return await parseDividendCSVFileForDuplicates(filePath);
    }

    // Otherwise, use P&L parser
    const results: any[] = [];
    let currentInstrumentType = '';
    let isHeaderRow = false;
    let headers: string[] = [];
    let skippedRecords = 0;
    let totalRecords = 0;

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      const instrumentTypes = [
        'Equity - Intraday',
        'Equity - Short Term',
        'Equity - Long Term',
        'Equity - Buyback',
        'Non Equity',
        'Mutual Funds',
        'F&O',
        'Currency',
        'Commodity'
      ];

      if (instrumentTypes.some(type => trimmedLine.startsWith(type))) {
        currentInstrumentType = trimmedLine.split(',')[0];
        isHeaderRow = true;
        continue;
      }

      if (trimmedLine && trimmedLine.includes(',') && currentInstrumentType) {
        const values = trimmedLine.split(',');
        totalRecords++;
        
        if (isHeaderRow) {
          if (values.length > 1 && values[0].trim() === 'Symbol') {
            headers = values.map(h => h.trim());
            isHeaderRow = false;
          }
          continue;
        }

        // Skip records where Symbol is empty
        const symbolIndex = headers.findIndex(h => h === 'Symbol');
        if (symbolIndex >= 0 && symbolIndex < values.length) {
          const symbolValue = values[symbolIndex]?.trim();
          if (!symbolValue || symbolValue === '') {
            skippedRecords++;
            continue;
          }
        }

        // Create record object
        const record: any = {
          instrumentType: currentInstrumentType
        };

        // Map CSV columns to record fields
        headers.forEach((header, index) => {
          const value = values[index]?.trim();
          if (value && value !== '') {
            switch (header) {
              case 'Symbol':
                record.symbol = value;
                break;
              case 'ISIN':
                record.isin = value;
                break;
              case 'Entry Date':
                record.entryDate = value ? new Date(value) : null;
                break;
              case 'Exit Date':
                record.exitDate = value ? new Date(value) : null;
                break;
              case 'Quantity':
                record.quantity = value ? parseFloat(value) : null;
                break;
              case 'Buy Value':
                record.buyValue = value ? parseFloat(value) : null;
                break;
              case 'Sell Value':
                record.sellValue = value ? parseFloat(value) : null;
                break;
              case 'Profit':
                record.profit = value ? parseFloat(value) : null;
                break;
              case 'Period of Holding':
                record.periodOfHolding = value;
                break;
              case 'Fair Market Value':
                record.fairMarketValue = value ? parseFloat(value) : null;
                break;
              case 'Taxable Profit':
                record.taxableProfit = value ? parseFloat(value) : null;
                break;
              case 'Turnover':
                record.turnover = value ? parseFloat(value) : null;
                break;
              case 'Brokerage':
                record.brokerage = value ? parseFloat(value) : null;
                break;
              case 'Exchange Transaction Charges':
                record.exchangeTransactionCharges = value ? parseFloat(value) : null;
                break;
              case 'IPFT':
                record.ipft = value ? parseFloat(value) : null;
                break;
              case 'SEBI Charges':
                record.sebiCharges = value ? parseFloat(value) : null;
                break;
              case 'CGST':
                record.cgst = value ? parseFloat(value) : null;
                break;
              case 'SGST':
                record.sgst = value ? parseFloat(value) : null;
                break;
              case 'IGST':
                record.igst = value ? parseFloat(value) : null;
                break;
              case 'Stamp Duty':
                record.stampDuty = value ? parseFloat(value) : null;
                break;
              case 'STT':
                record.stt = value ? parseFloat(value) : null;
                break;
            }
          }
        });

        results.push(record);
      }
    }

    serviceLogger.logServiceOperation('PnL', 'parseCSVFileForDuplicates', `Parsed ${results.length} valid records from ${totalRecords} total records (skipped ${skippedRecords} records with empty symbols)`);
    return results;

  } catch (error) {
    serviceLogger.logServiceError('PnL', 'parseCSVFileForDuplicates', error);
    throw error;
  }
}

// Extract Excel worksheets to CSV files
router.post('/extract-excel', excelUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const tempDir = path.join(__dirname, '../../uploads/temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Read the Excel file
    const workbook = XLSX.readFile(req.file.path);
    const sheetNames = workbook.SheetNames;
    const excelBaseName = path.basename(req.file.path, path.extname(req.file.path));
    
    const extractedFiles: Array<{ name: string; path: string; sheetName: string }> = [];

    // Convert each sheet to CSV
    for (const sheetName of sheetNames) {
      try {
        const worksheet = workbook.Sheets[sheetName];
        const csvData = XLSX.utils.sheet_to_csv(worksheet);
        
        // Create a safe filename from sheet name
        const safeSheetName = sheetName.replace(/[<>:"/\\|?*]/g, '_').trim();
        const csvFileName = `${excelBaseName}-${safeSheetName}.csv`;
        const csvFilePath = path.join(tempDir, csvFileName);
        
        // Write CSV file
        fs.writeFileSync(csvFilePath, csvData, 'utf8');
        
        extractedFiles.push({
          name: csvFileName,
          path: csvFilePath,
          sheetName: sheetName
        });
      } catch (error) {
        serviceLogger.logServiceError('PnL', 'extractExcelSheet', error);
        // Continue with other sheets even if one fails
      }
    }

    // Clean up the uploaded Excel file
    fs.unlinkSync(req.file.path);

    res.json({
      message: 'Excel file extracted successfully',
      extractedFiles: extractedFiles.map(f => ({
        name: f.name,
        sheetName: f.sheetName
      }))
    });

  } catch (error) {
    serviceLogger.logServiceError('PnL', 'extractExcel', error);
    res.status(500).json({ error: 'Failed to extract Excel file' });
  }
});

// Parse and check duplicates for CSV file from temp directory
router.post('/parse-and-check-duplicates-temp/:accountId', async (req, res) => {
  try {
    const { fileNames } = req.body; // Array of file names
    const accountId = parseInt(req.params.accountId);

    if (!fileNames || !Array.isArray(fileNames) || fileNames.length === 0) {
      return res.status(400).json({ error: 'File names array is required' });
    }

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    // Verify account exists
    const account = await prisma.account.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const tempDir = path.join(__dirname, '../../uploads/temp');
    let allParsedRecords: any[] = [];
    let allDuplicates: any[] = [];
    let pnlRecords: any[] = [];
    let dividendRecords: any[] = [];

    // Process each file
    for (const fileName of fileNames) {
      const csvFilePath = path.join(tempDir, fileName);
      
      if (!fs.existsSync(csvFilePath)) {
        continue; // Skip if file doesn't exist
      }

      // Check if this is a dividend file
      if (isDividendFile(csvFilePath)) {
        // Parse as dividend file
        const parsedRecords = await parseDividendCSVFileForDuplicates(csvFilePath);
        dividendRecords.push(...parsedRecords);
        allParsedRecords.push(...parsedRecords);
      } else {
        // Parse as P&L file
        const parsedRecords = await parseCSVFileForDuplicates(csvFilePath);
        pnlRecords.push(...parsedRecords);
        allParsedRecords.push(...parsedRecords);
      }
    }

    // Check duplicates for P&L records
    const existingPnLRecords = await prisma.pnLRecord.findMany({
      where: { accountId },
      select: {
        symbol: true,
        instrumentType: true,
        entryDate: true,
        exitDate: true,
        quantity: true,
        buyValue: true,
        sellValue: true,
        profit: true
      }
    });

    let pnlDuplicates: any[] = [];
    if (existingPnLRecords.length > 0 && pnlRecords.length > 0) {
      pnlDuplicates = pnlRecords.filter(record => {
        return existingPnLRecords.some(existing => 
          existing.symbol === record.symbol &&
          existing.instrumentType === record.instrumentType &&
          existing.entryDate?.getTime() === record.entryDate?.getTime() &&
          existing.exitDate?.getTime() === record.exitDate?.getTime() &&
          existing.quantity === record.quantity &&
          existing.buyValue === record.buyValue &&
          existing.sellValue === record.sellValue &&
          existing.profit === record.profit
        );
      });
    }

    // Check duplicates for dividend records
    const existingDividendRecords = await prisma.dividendRecord.findMany({
      where: { accountId },
      select: {
        symbol: true,
        isin: true,
        exDate: true,
        quantity: true,
        dividendPerShare: true,
        netDividendAmount: true
      }
    });

    let dividendDuplicates: any[] = [];
    if (existingDividendRecords.length > 0 && dividendRecords.length > 0) {
      dividendDuplicates = dividendRecords.filter(record => {
        return existingDividendRecords.some(existing => 
          existing.symbol === record.symbol &&
          existing.isin === record.isin &&
          existing.exDate?.getTime() === record.exDate?.getTime() &&
          existing.quantity === record.quantity &&
          existing.dividendPerShare === record.dividendPerShare &&
          existing.netDividendAmount === record.netDividendAmount
        );
      });
    }

    // Combine all duplicates
    allDuplicates = [...pnlDuplicates, ...dividendDuplicates];

    // Group records by instrument type (for P&L) or by type (for dividends)
    const recordsByInstrumentType: Record<string, { total: number; duplicates: number; unique: number }> = {};
    
    // Group P&L records
    pnlRecords.forEach(record => {
      const instrumentType = record.instrumentType || 'Unknown';
      if (!recordsByInstrumentType[instrumentType]) {
        recordsByInstrumentType[instrumentType] = { total: 0, duplicates: 0, unique: 0 };
      }
      recordsByInstrumentType[instrumentType].total++;
    });

    // Group dividend records
    if (dividendRecords.length > 0) {
      if (!recordsByInstrumentType['Equity Dividends']) {
        recordsByInstrumentType['Equity Dividends'] = { total: 0, duplicates: 0, unique: 0 };
      }
      recordsByInstrumentType['Equity Dividends'].total += dividendRecords.length;
    }

    // Count duplicates by instrument type
    pnlDuplicates.forEach(duplicate => {
      const instrumentType = duplicate.instrumentType || 'Unknown';
      if (recordsByInstrumentType[instrumentType]) {
        recordsByInstrumentType[instrumentType].duplicates++;
      }
    });

    if (dividendDuplicates.length > 0) {
      if (recordsByInstrumentType['Equity Dividends']) {
        recordsByInstrumentType['Equity Dividends'].duplicates += dividendDuplicates.length;
      }
    }

    // Calculate unique records by instrument type
    Object.keys(recordsByInstrumentType).forEach(instrumentType => {
      recordsByInstrumentType[instrumentType].unique = 
        recordsByInstrumentType[instrumentType].total - recordsByInstrumentType[instrumentType].duplicates;
    });

    let totalRecords = allParsedRecords.length;

    res.json({
      totalRecords,
      duplicateCount: allDuplicates.length,
      duplicates: allDuplicates,
      uniqueRecords: totalRecords - allDuplicates.length,
      recordsByInstrumentType,
      parsedRecords: allParsedRecords // Include all parsed records for preview
    });

  } catch (error) {
    serviceLogger.logServiceError('PnL', 'parseAndCheckDuplicatesTemp', error);
    res.status(500).json({ error: 'Failed to parse file and check duplicates' });
  }
});

// Upload CSV file from temp directory by filename
router.post('/upload-csv-from-temp', async (req, res) => {
  try {
    const { fileName, accountId, skipDuplicates } = req.body;

    if (!fileName || !accountId) {
      return res.status(400).json({ error: 'File name and account ID are required' });
    }

    const tempDir = path.join(__dirname, '../../uploads/temp');
    const csvFilePath = path.join(tempDir, fileName);

    if (!fs.existsSync(csvFilePath)) {
      return res.status(404).json({ error: 'CSV file not found in temp directory' });
    }

    // Verify account exists
    const account = await prisma.account.findUnique({
      where: { id: parseInt(accountId) }
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Process the CSV file
    processCSVFile(csvFilePath, parseInt(accountId), skipDuplicates === true);

    // Clean up the temp CSV file after processing
    setTimeout(() => {
      try {
        if (fs.existsSync(csvFilePath)) {
          fs.unlinkSync(csvFilePath);
        }
      } catch (error) {
        serviceLogger.logServiceError('PnL', 'cleanupTempFile', error);
      }
    }, 5000); // Wait 5 seconds before cleanup to ensure processing started

    res.json({ 
      message: 'CSV file uploaded successfully', 
      accountId: parseInt(accountId),
      status: 'processing'
    });

  } catch (error) {
    serviceLogger.logServiceError('PnL', 'uploadCsvFromTemp', error);
    res.status(500).json({ error: 'Failed to upload CSV file' });
  }
});

export default router;
