import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { serviceLogger } from '../utils/serviceLogger';

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for file uploads
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
    cb(null, 'dividend-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Upload dividend CSV file
router.post('/upload/:accountId', upload.single('file'), async (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId);
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!req.body.accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const skipDuplicates = req.body.skipDuplicates === 'true';

    // Create dividend upload record
    const dividendUpload = await prisma.dividendUpload.create({
      data: {
        accountId,
        fileName: file.originalname,
        status: 'processing'
      }
    });

    // Process the file asynchronously
    processDividendCSVFile(file.path, dividendUpload.id, accountId, skipDuplicates);

    serviceLogger.logServiceOperation('Dividend', 'upload', `Started processing dividend file: ${file.originalname}`);
    res.json({ 
      message: 'Dividend file uploaded successfully', 
      uploadId: dividendUpload.id 
    });

  } catch (error) {
    serviceLogger.logServiceError('Dividend', 'upload', error);
    res.status(500).json({ error: 'Failed to upload dividend file' });
  }
});

// Get all dividend uploads for an account
router.get('/uploads/:accountId', async (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId);

    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }

    const uploads = await prisma.dividendUpload.findMany({
      where: { accountId },
      orderBy: { uploadDate: 'desc' }
    });

    serviceLogger.logServiceOperation('Dividend', 'getUploads', `Retrieved ${uploads.length} dividend uploads for account ${accountId}`);
    res.json(uploads);
  } catch (error) {
    serviceLogger.logServiceError('Dividend', 'getUploads', error);
    res.status(500).json({ error: 'Failed to fetch dividend uploads' });
  }
});

// Get all dividend records for an account
router.get('/account/:accountId/records', async (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId);

    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }

    // Get all uploads for the account
    const uploads = await prisma.dividendUpload.findMany({
      where: { accountId },
      select: { id: true }
    });

    if (uploads.length === 0) {
      return res.json([]);
    }

    // Get all records from all uploads with account information
    const records = await prisma.dividendRecord.findMany({
      where: {
        uploadId: {
          in: uploads.map(upload => upload.id)
        }
      },
      include: {
        upload: {
          include: {
            account: {
              select: {
                id: true,
                name: true,
                family: true,
              },
            },
          },
        },
      },
      orderBy: [
        { exDate: 'desc' },
        { symbol: 'asc' }
      ]
    });

    serviceLogger.logServiceOperation('Dividend', 'getAccountRecords', `Retrieved ${records.length} dividend records for account ${accountId}`);
    res.json(records);
  } catch (error) {
    serviceLogger.logServiceError('Dividend', 'getAccountRecords', error);
    res.status(500).json({ error: 'Failed to fetch dividend records' });
  }
});

// Delete dividend upload
router.delete('/upload/:uploadId', async (req, res) => {
  try {
    const uploadId = parseInt(req.params.uploadId);

    if (isNaN(uploadId)) {
      return res.status(400).json({ error: 'Invalid upload ID' });
    }

    await prisma.dividendUpload.delete({
      where: { id: uploadId }
    });

    serviceLogger.logServiceOperation('Dividend', 'deleteUpload', `Deleted dividend upload ${uploadId}`);
    res.json({ message: 'Dividend upload deleted successfully' });
  } catch (error) {
    serviceLogger.logServiceError('Dividend', 'deleteUpload', error);
    res.status(500).json({ error: 'Failed to delete dividend upload' });
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
    const uploads = await prisma.dividendUpload.findMany({
      where: { accountId },
      select: { id: true }
    });

    if (uploads.length === 0) {
      return res.json({ duplicates: [], totalRecords: records.length, duplicateCount: 0 });
    }

    const existingRecords = await prisma.dividendRecord.findMany({
      where: {
        uploadId: {
          in: uploads.map(upload => upload.id)
        }
      },
      select: {
        symbol: true,
        isin: true,
        exDate: true,
        quantity: true,
        dividendPerShare: true,
        netDividendAmount: true
      }
    });

    // Check for duplicates
    const duplicates = records.filter(record => {
      return existingRecords.some(existing => 
        existing.symbol === record.symbol &&
        existing.isin === record.isin &&
        existing.exDate?.getTime() === record.exDate?.getTime() &&
        existing.quantity === record.quantity &&
        existing.dividendPerShare === record.dividendPerShare &&
        existing.netDividendAmount === record.netDividendAmount
      );
    });

    res.json({
      duplicates,
      totalRecords: records.length,
      duplicateCount: duplicates.length
    });

  } catch (error) {
    serviceLogger.logServiceError('Dividend', 'checkDuplicates', error);
    res.status(500).json({ error: 'Failed to check for duplicates' });
  }
});

// Cleanup empty dividend records
router.delete('/cleanup-empty-records', async (req, res) => {
  try {
    // Delete records where symbol is null, empty, or where all numeric fields are null/zero
    const deletedRecords = await prisma.dividendRecord.deleteMany({
      where: {
        OR: [
          { symbol: null },
          { symbol: '' },
          {
            AND: [
              { quantity: null },
              { dividendPerShare: null },
              { netDividendAmount: null }
            ]
          },
          {
            AND: [
              { quantity: 0 },
              { dividendPerShare: 0 },
              { netDividendAmount: 0 }
            ]
          }
        ]
      }
    });

    serviceLogger.logServiceOperation('Dividend', 'cleanupEmptyRecords', `Deleted ${deletedRecords.count} empty dividend records`);
    res.json({ 
      message: `Cleaned up ${deletedRecords.count} empty dividend records`,
      deletedCount: deletedRecords.count
    });
  } catch (error) {
    serviceLogger.logServiceError('Dividend', 'cleanupEmptyRecords', error);
    res.status(500).json({ error: 'Failed to cleanup empty dividend records' });
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
    const parsedRecords = await parseDividendCSVFileForDuplicates(req.file.path);
    
    // Get all existing records for this account
    const uploads = await prisma.dividendUpload.findMany({
      where: { accountId },
      select: { id: true }
    });

    let duplicates: any[] = [];
    let totalRecords = parsedRecords.length;

    if (uploads.length > 0) {
      const existingRecords = await prisma.dividendRecord.findMany({
        where: {
          uploadId: {
            in: uploads.map(upload => upload.id)
          }
        },
        select: {
          symbol: true,
          isin: true,
          exDate: true,
          quantity: true,
          dividendPerShare: true,
          netDividendAmount: true
        }
      });

      // Check for duplicates
      duplicates = parsedRecords.filter(record => {
        return existingRecords.some(existing => 
          existing.symbol === record.symbol &&
          existing.isin === record.isin &&
          existing.exDate?.getTime() === record.exDate?.getTime() &&
          existing.quantity === record.quantity &&
          existing.dividendPerShare === record.dividendPerShare &&
          existing.netDividendAmount === record.netDividendAmount
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
    serviceLogger.logServiceError('Dividend', 'parseAndCheckDuplicates', error);
    res.status(500).json({ error: 'Failed to parse file and check duplicates' });
  }
});

// Function to parse dividend CSV file for duplicate checking (without saving to database)
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

    serviceLogger.logServiceOperation('Dividend', 'parseCSVFileForDuplicates', `Processing file with ${lines.length} lines`);

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const trimmedLine = line.trim();
      
      if (!trimmedLine) continue;

      // Check if this is the dividend data section
      if (trimmedLine.includes('Equity Dividends from') || (trimmedLine.includes('Dividend') && !trimmedLine.includes('Symbol'))) {
        isDataSection = true;
        serviceLogger.logServiceOperation('Dividend', 'parseCSVFileForDuplicates', `Found dividend section at line ${lineIndex + 1}: ${trimmedLine}`);
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
          serviceLogger.logServiceOperation('Dividend', 'parseCSVFileForDuplicates', `Found header row at line ${lineIndex + 1}: ${headers.join(', ')}`);
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

    serviceLogger.logServiceOperation('Dividend', 'parseCSVFileForDuplicates', `Parsed ${results.length} valid dividend records from ${totalRecords} total records (skipped ${skippedRecords} empty/invalid records)`);
    return results;

  } catch (error) {
    serviceLogger.logServiceError('Dividend', 'parseCSVFileForDuplicates', error);
    throw error;
  }
}

// Process dividend CSV file
async function processDividendCSVFile(filePath: string, uploadId: number, accountId: number, skipDuplicates: boolean = false) {
  try {
    const results: any[] = [];
    let headers: string[] = [];
    let isDataSection = false;
    let foundHeaderRow = false;
    let totalRecords = 0;
    let skippedRecords = 0;

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');

    serviceLogger.logServiceOperation('Dividend', 'processCSVFile', `Processing file with ${lines.length} lines`);

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const trimmedLine = line.trim();
      
      if (!trimmedLine) continue;

      // Check if this is the dividend data section
      if (trimmedLine.includes('Equity Dividends from') || (trimmedLine.includes('Dividend') && !trimmedLine.includes('Symbol'))) {
        isDataSection = true;
        serviceLogger.logServiceOperation('Dividend', 'processCSVFile', `Found dividend section at line ${lineIndex + 1}: ${trimmedLine}`);
        continue;
      }

      // If we're in the data section and this line has comma-separated values
      if (isDataSection && trimmedLine && trimmedLine.includes(',')) {
        const values = trimmedLine.split(',');
        totalRecords++;

        // Check if this is the header row (Symbol,ISIN,Ex-date,Quantity,Dividend Per Share,Net Dividend Amount)
        if (values.length > 1 && values[0].trim() === 'Symbol') {
          headers = values.map(h => h.trim());
          foundHeaderRow = true;
          serviceLogger.logServiceOperation('Dividend', 'processCSVFile', `Found header row at line ${lineIndex + 1}: ${headers.join(', ')}`);
          continue;
        }

        // Skip if we haven't found the header row yet
        if (!foundHeaderRow) {
          serviceLogger.logServiceOperation('Dividend', 'processCSVFile', `Skipping line ${lineIndex + 1} - no header row found yet`);
          continue;
        }

        // Skip if this is not a data row (e.g., total row, empty rows, or summary rows)
        if (values[0].trim() === 'Total Dividend Amount' || 
            values[0].trim() === '' || 
            values[0].trim().toLowerCase().includes('total') ||
            values[0].trim().toLowerCase().includes('dividends are credited')) {
          serviceLogger.logServiceOperation('Dividend', 'processCSVFile', `Skipping summary row at line ${lineIndex + 1}: ${values[0].trim()}`);
          continue;
        }

        // Enhanced validation: Skip records where Symbol is empty or contains only whitespace
        const symbolValue = values[0]?.trim();
        if (!symbolValue || symbolValue === '') {
          skippedRecords++;
          serviceLogger.logServiceOperation('Dividend', 'processCSVFile', `Skipping empty symbol at line ${lineIndex + 1}`);
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
          serviceLogger.logServiceOperation('Dividend', 'processCSVFile', `Skipping row with no meaningful data at line ${lineIndex + 1}`);
          continue;
        }

        // Create record object
        const record: any = {
          uploadId,
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
          serviceLogger.logServiceOperation('Dividend', 'processCSVFile', `Added record at line ${lineIndex + 1}: ${record.symbol} - Qty: ${record.quantity}, DPS: ${record.dividendPerShare}, Amount: ${record.netDividendAmount}`);
        } else {
          skippedRecords++;
          serviceLogger.logServiceOperation('Dividend', 'processCSVFile', `Skipping invalid record at line ${lineIndex + 1}: ${JSON.stringify(record)}`);
        }
      }
    }

    serviceLogger.logServiceOperation('Dividend', 'processCSVFile', `Parsed ${results.length} valid dividend records from ${totalRecords} total records (skipped ${skippedRecords} empty/invalid records)`);

    // Insert records with duplicate prevention
    if (results.length > 0) {
      let insertedCount = 0;
      let skippedCount = 0;
      
      if (skipDuplicates) {
        // Get existing records to filter out duplicates before insertion
        const uploads = await prisma.dividendUpload.findMany({
          where: { accountId },
          select: { id: true }
        });

        if (uploads.length > 0) {
          const existingRecords = await prisma.dividendRecord.findMany({
            where: {
              uploadId: {
                in: uploads.map(upload => upload.id)
              }
            },
            select: {
              symbol: true,
              isin: true,
              exDate: true,
              quantity: true,
              dividendPerShare: true,
              netDividendAmount: true
            }
          });

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
              serviceLogger.logServiceOperation('Dividend', 'processCSVFile', `Skipped duplicate record: ${record.symbol} - ${record.exDate}`);
            } else {
              // Re-throw if it's not a duplicate error
              throw error;
            }
          }
        }
      }
      
      serviceLogger.logServiceOperation('Dividend', 'processCSVFile', `Inserted ${insertedCount} new records, skipped ${skippedCount} duplicates`);
    } else {
      serviceLogger.logServiceOperation('Dividend', 'processCSVFile', `No valid records found to insert`);
    }

    // Update upload status
    await prisma.dividendUpload.update({
      where: { id: uploadId },
      data: { status: 'completed' }
    });

    // Clean up the uploaded file
    fs.unlinkSync(filePath);

    serviceLogger.logServiceOperation('Dividend', 'processCSVFile', `Successfully processed dividend CSV file with ${results.length} records`);
  } catch (error) {
    serviceLogger.logServiceError('Dividend', 'processCSVFile', error);
    await prisma.dividendUpload.update({ where: { id: uploadId }, data: { status: 'failed' } });
    
    // Clean up the uploaded file even if processing failed
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (cleanupError) {
      serviceLogger.logServiceError('Dividend', 'fileCleanup', cleanupError);
    }
  }
}

export default router;
