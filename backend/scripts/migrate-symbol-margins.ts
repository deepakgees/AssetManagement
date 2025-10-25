import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import logger from '../src/utils/logger';

const prisma = new PrismaClient();

async function migrateSymbolMargins() {
  try {
    logger.info('Starting symbol margins migration...');
    
    // Read the SQL migration file
    const sqlPath = path.join(__dirname, 'migrate-symbol-margins.sql');
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
    const symbolMarginsCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM symbol_margins`;
    const safetyMarginsCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM safety_margins`;
    const symbolAndMarginsCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM symbol_and_margins`;
    
    logger.info('Migration completed successfully!');
    logger.info(`New symbol_margins table has ${(symbolMarginsCount as any)[0].count} records`);
    logger.info(`Original safety_margins table had ${(safetyMarginsCount as any)[0].count} records`);
    logger.info(`Original symbol_and_margins table had ${(symbolAndMarginsCount as any)[0].count} records`);
    
  } catch (error) {
    logger.error('Error during migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  migrateSymbolMargins()
    .then(() => {
      logger.info('Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}

export default migrateSymbolMargins;
