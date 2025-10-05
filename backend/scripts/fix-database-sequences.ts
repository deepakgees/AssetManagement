import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixDatabaseSequences() {
  try {
    console.log('🔧 Starting database sequence fix...');
    
    // Check current state of accounts table
    const accounts = await prisma.account.findMany({
      select: { id: true },
      orderBy: { id: 'desc' },
      take: 1
    });
    
    const maxId = accounts.length > 0 ? accounts[0].id : 0;
    console.log(`📊 Current max account ID: ${maxId}`);
    
    // Reset the sequence for accounts table
    await prisma.$executeRaw`SELECT setval('accounts_id_seq', ${maxId + 1}, false)`;
    console.log(`✅ Accounts sequence reset to: ${maxId + 1}`);
    
    // Test the sequence by getting the next value
    const nextId = await prisma.$queryRaw`SELECT nextval('accounts_id_seq') as next_id`;
    console.log(`🧪 Next sequence value: ${(nextId as any)[0].next_id}`);
    
    console.log('✅ Database sequence fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing database sequences:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix if this script is executed directly
if (require.main === module) {
  fixDatabaseSequences()
    .then(() => {
      console.log('🎉 Sequence fix completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Sequence fix failed:', error);
      process.exit(1);
    });
}

export default fixDatabaseSequences;
