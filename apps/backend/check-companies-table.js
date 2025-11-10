const { Pool } = require('pg');

const pool = new Pool({
  host: '100.93.172.21',
  port: 5432,
  database: 'nse_hist_db',
  user: 'myuser',
  password: 'mypassword'
});

async function main() {
  try {
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
    
    // Check sample data
    const sampleData = await pool.query('SELECT * FROM companies LIMIT 5');
    console.log('\n📄 SAMPLE DATA:');
    console.table(sampleData.rows);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

main();
