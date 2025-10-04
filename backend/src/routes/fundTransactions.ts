import express from 'express';
import multer from 'multer';
import { FundTransactionService } from '../services/fundTransactionService';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Get all transactions for an account
router.get('/account/:accountId', async (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId);
    const transactions = await FundTransactionService.getAccountTransactions(accountId);
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching account transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Get all transactions for a family
router.get('/family/:familyName', async (req, res) => {
  try {
    const familyName = req.params.familyName;
    const transactions = await FundTransactionService.getFamilyTransactions(familyName);
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching family transactions:', error);
    res.status(500).json({ error: 'Failed to fetch family transactions' });
  }
});

// Create a new transaction
router.post('/', async (req, res) => {
  try {
    const { accountId, transactionDate, amount, type, description } = req.body;

    if (!accountId || !transactionDate || !amount || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (type !== 'ADDITION' && type !== 'WITHDRAWAL') {
      return res.status(400).json({ error: 'Type must be ADDITION or WITHDRAWAL' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' });
    }

    const transaction = await FundTransactionService.createTransaction({
      accountId,
      transactionDate: new Date(transactionDate),
      amount,
      type,
      description,
    });

    res.status(201).json(transaction);
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// Update a transaction
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { accountId, transactionDate, amount, type, description } = req.body;

    const updateData: any = {};
    if (accountId !== undefined) updateData.accountId = accountId;
    if (transactionDate !== undefined) updateData.transactionDate = new Date(transactionDate);
    if (amount !== undefined) updateData.amount = amount;
    if (type !== undefined) updateData.type = type;
    if (description !== undefined) updateData.description = description;

    const transaction = await FundTransactionService.updateTransaction(id, updateData);
    res.json(transaction);
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// Delete a transaction
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await FundTransactionService.deleteTransaction(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// Calculate XIRR for an account
router.get('/xirr/account/:accountId', async (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId);
    const currentValue = parseFloat(req.query.currentValue as string);

    if (isNaN(currentValue)) {
      return res.status(400).json({ error: 'currentValue query parameter is required' });
    }

    const xirrCalculation = await FundTransactionService.calculateAccountXIRR(accountId, currentValue);
    res.json(xirrCalculation);
  } catch (error) {
    console.error('Error calculating account XIRR:', error);
    res.status(500).json({ error: 'Failed to calculate XIRR' });
  }
});

// Calculate XIRR for a family
router.get('/xirr/family/:familyName', async (req, res) => {
  try {
    const familyName = req.params.familyName;
    const currentValue = parseFloat(req.query.currentValue as string);

    if (isNaN(currentValue)) {
      return res.status(400).json({ error: 'currentValue query parameter is required' });
    }

    const xirrCalculation = await FundTransactionService.calculateFamilyXIRR(familyName, currentValue);
    res.json(xirrCalculation);
  } catch (error) {
    console.error('Error calculating family XIRR:', error);
    res.status(500).json({ error: 'Failed to calculate XIRR' });
  }
});

// Check for duplicates in CSV file before uploading
router.post('/check-duplicates', upload.single('file'), async (req, res) => {
  try {
    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'CSV file is required' });
    }

    // Parse the CSV file and check for duplicates
    const duplicateCheckResult = await FundTransactionService.parseAndCheckDuplicates(
      req.file.buffer,
      parseInt(accountId)
    );

    res.json(duplicateCheckResult);
  } catch (error) {
    console.error('Error checking duplicates:', error);
    res.status(500).json({ error: 'Failed to check duplicates' });
  }
});

// Upload CSV file for fund transactions (unique records only)
router.post('/upload-csv-unique', upload.single('file'), async (req, res) => {
  try {
    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'CSV file is required' });
    }

    // Parse the CSV file and get only unique records
    const duplicateCheckResult = await FundTransactionService.parseAndCheckDuplicates(
      req.file.buffer,
      parseInt(accountId)
    );
    
    if (duplicateCheckResult.uniqueRecords.length === 0) {
      return res.status(400).json({ error: 'No unique transactions found in the CSV file' });
    }

    // Create only unique transactions in database
    const createdTransactions = await FundTransactionService.createTransactionsFromCSV(
      parseInt(accountId),
      duplicateCheckResult.uniqueRecords
    );

    res.json({
      message: 'CSV uploaded successfully',
      transactionsCreated: createdTransactions.length,
      transactions: createdTransactions
    });
  } catch (error) {
    console.error('Error uploading CSV:', error);
    res.status(500).json({ error: 'Failed to upload CSV' });
  }
});

// Upload CSV file for fund transactions
router.post('/upload-csv', upload.single('file'), async (req, res) => {
  try {
    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'CSV file is required' });
    }

    // Parse the CSV file
    const parsedTransactions = await FundTransactionService.parseLedgerCSV(req.file.buffer);
    
    if (parsedTransactions.length === 0) {
      return res.status(400).json({ error: 'No valid transactions found in the CSV file' });
    }

    // Create transactions in database
    const createdTransactions = await FundTransactionService.createTransactionsFromCSV(
      parseInt(accountId),
      parsedTransactions
    );

    res.json({
      message: 'CSV uploaded successfully',
      transactionsCreated: createdTransactions.length,
      transactions: createdTransactions
    });
  } catch (error) {
    console.error('Error uploading CSV:', error);
    res.status(500).json({ error: 'Failed to upload CSV file' });
  }
});

export default router;
