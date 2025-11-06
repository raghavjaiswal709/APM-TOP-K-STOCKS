const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

async function checkSchema() {
  try {
    await client.connect();
    console.log('✅ Connected to database:', process.env.DB_DATABASE);
    console.log('✅ Host:', process.env.DB_HOST);
    console.log('\n' + '='.repeat(80));
    
    // 1. List all tables
    console.log('\n📋 ALL TABLES IN DATABASE:');
    const tables = await client.query(`
      SELECT schemaname, tablename 
      FROM pg_tables 
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schemaname, tablename
    `);
    console.table(tables.rows);
    
    // 2. Check for watchlist-related tables
    console.log('\n🔍 SEARCHING FOR WATCHLIST TABLES:');
    const watchlistTables = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE tablename ILIKE '%watchlist%' 
         OR tablename ILIKE '%company%'
      ORDER BY tablename
    `);
    
    if (watchlistTables.rows.length === 0) {
      console.log('❌ No watchlist/company tables found!');
      console.log('\n💡 Your database might use different table names.');
      console.log('Please check the actual table names above and update the entity files.');
    } else {
      console.log('✅ Found tables:');
      console.table(watchlistTables.rows);
      
      // 3. Check structure of each found table
      for (const row of watchlistTables.rows) {
        console.log(`\n📊 STRUCTURE OF TABLE: ${row.tablename}`);
        const structure = await client.query(`
          SELECT 
            column_name, 
            data_type, 
            character_maximum_length,
            is_nullable
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [row.tablename]);
        console.table(structure.rows);
        
        // 4. Check row count
        const countResult = await client.query(`SELECT COUNT(*) FROM ${row.tablename}`);
        console.log(`📈 Row count: ${countResult.rows[0].count}`);
        
        // 5. Show sample data
        const sampleResult = await client.query(`SELECT * FROM ${row.tablename} LIMIT 3`);
        if (sampleResult.rows.length > 0) {
          console.log('📄 Sample data:');
          console.table(sampleResult.rows);
        } else {
          console.log('⚠️  Table is empty!');
        }
      }
    }
    
    // 6. Search for tables with 'A', 'B', 'C' or date columns
    console.log('\n🔍 TABLES WITH DATE COLUMNS:');
    const dateColumns = await client.query(`
      SELECT DISTINCT table_name, column_name
      FROM information_schema.columns
      WHERE data_type IN ('date', 'timestamp without time zone', 'timestamp with time zone')
        AND table_schema = 'public'
      ORDER BY table_name
    `);
    console.table(dateColumns.rows);
    
    await client.end();
    console.log('\n✅ Database check complete!');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Full error:', err);
  }
}

checkSchema();
