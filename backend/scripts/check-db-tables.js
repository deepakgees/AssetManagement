const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTables() {
  try {
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE' 
      AND table_name NOT LIKE '_prisma%' 
      ORDER BY table_name
    `;
    
    console.log('Database tables:');
    tables.forEach(t => console.log(`  - ${t.table_name}`));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTables();

