import express from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { serviceLogger } from '../utils/serviceLogger';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';

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

    // Clean up the uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      totalRecords,
      duplicateCount: duplicates.length,
      duplicates,
      uniqueRecords: totalRecords - duplicates.length
    });

  } catch (error) {
    serviceLogger.logServiceError('PnL', 'parseAndCheckDuplicates', error);
    res.status(500).json({ error: 'Failed to parse file and check duplicates' });
  }
});

// Function to process CSV file
async function processCSVFile(filePath: string, accountId: number, skipDuplicates: boolean = false) {
  try {
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

    try {
      // Insert all records into database with duplicate prevention
      if (results.length > 0) {
        let insertedCount = 0;
        let skippedCount = 0;
        
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
            const uniqueRecords = results.filter(record => {
              return !existingRecords.some(existing => 
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

            skippedCount = results.length - uniqueRecords.length;
            
            // Insert only unique records
            if (uniqueRecords.length > 0) {
              await prisma.pnLRecord.createMany({
                data: uniqueRecords
              });
              insertedCount = uniqueRecords.length;
            }
          } else {
            // No existing records, insert all
            await prisma.pnLRecord.createMany({
              data: results
            });
            insertedCount = results.length;
          }
        } else {
          // Original duplicate prevention logic
          for (const record of results) {
            try {
              await prisma.pnLRecord.create({
                data: record
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
        
        serviceLogger.logServiceOperation('PnL', 'processCSVFile', `Inserted ${insertedCount} new records, skipped ${skippedCount} duplicates`);
      }

      // Clean up the uploaded file
      fs.unlinkSync(filePath);

      serviceLogger.logServiceOperation('PnL', 'processCSVFile', `Successfully processed CSV file with ${results.length} records`);
    } catch (dbError) {
      serviceLogger.logServiceError('PnL', 'saveRecords', dbError);
    }

  } catch (error) {
    serviceLogger.logServiceError('PnL', 'processCSVFile', error);
  }
}

// Function to parse CSV file for duplicate checking (without saving to database)
async function parseCSVFileForDuplicates(filePath: string): Promise<any[]> {
  try {
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

export default router;
