import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import logger from '../src/utils/logger';

const prisma = new PrismaClient();

async function addLotSizeColumn() {
  try {
    logger.info('Starting lot size column migration...');
    
    // Read the SQL migration file
    const sqlPath = path.join(__dirname, 'add-lot-size-column.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Split the SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        logger.info(`Executing: ${statement.substring(0, 100)}...`);
        await prisma.$executeRawUnsafe(statement);
      }
    }
    
    // Verify the migration
    const columnInfo = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'symbol_margins' AND column_name = 'lot_size'
    `;
    
    logger.info('Migration completed successfully!');
    logger.info('Column info:', columnInfo);
    
  } catch (error) {
    logger.error('Error during migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  addLotSizeColumn()
    .then(() => {
      logger.info('Lot size column migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Lot size column migration failed:', error);
      process.exit(1);
    });
}

export default addLotSizeColumn;

