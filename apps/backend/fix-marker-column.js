const { Pool } = require('pg');
require('dotenv').config();

// Read from the same source as backend
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE
});

async function main() {
  try {
    console.log(`🔗 Connecting to: ${pool.options.database}@${pool.options.host}`);
    
    // Check companies table structure
    const result = await pool.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'companies'
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📋 COMPANIES TABLE STRUCTURE:');
    console.table(result.rows);
    
    // Check if marker column exists
    const hasMarker = result.rows.some(row => row.column_name === 'marker');
    console.log(`\n${hasMarker ? '✅' : '❌'} Marker column ${hasMarker ? 'EXISTS' : 'MISSING'}!`);
    
    if (!hasMarker) {
      console.log('\n⚠️  Adding marker column to companies table...');
      await pool.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS marker VARCHAR(10);`);
      console.log('✅ Marker column added!');
    }
    
    // Check sample data with OLAELEC
    const sampleData = await pool.query(`SELECT * FROM companies WHERE company_code = 'OLAELEC' LIMIT 5`);
    console.log('\n📄 OLAELEC DATA:');
    console.table(sampleData.rows);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

main();
