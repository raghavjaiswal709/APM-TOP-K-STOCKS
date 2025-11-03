// const { Client } = require('pg');

// async function checkICICIBANK() {
//   const client = new Client({
//     host: '100.93.172.21',
//     port: 5432,
//     user: 'readonly_user',
//     password: 'db_read_5432',
//     database: 'nse_hist_db',
//     ssl: {
//       rejectUnauthorized: false, // helps if remote SSL not configured
//     },
//   });

//   try {
//     await client.connect();
//     console.log('✅ Connected to database\n');

//     // Query 1: All dates
//     console.log('📅 ALL DATES WHEN ICICIBANK IS IN WATCHLIST:');
//     console.log('='.repeat(60));
//     const result = await client.query(`
//       SELECT 
//           dw.watchlist_date,
//           dw.company_code,
//           dw.exchange,
//           c.name,
//           dw.created_at
//       FROM daily_watchlist dw
//       LEFT JOIN companies c ON dw.company_id = c.company_id
//       WHERE dw.company_code = 'ICICIBANK'
//       ORDER BY dw.watchlist_date DESC
//     `);

//     if (result.rows.length === 0) {
//       console.log('❌ ICICIBANK NOT FOUND in daily_watchlist table');
//     } else {
//       console.log(`✅ Found ${result.rows.length} entries:\n`);
//       console.table(result.rows);
//     }

//     // Query 2: Latest date
//     console.log('\n📌 LATEST DATE:');
//     console.log('='.repeat(60));
//     const latestResult = await client.query(`
//       SELECT 
//           MAX(watchlist_date) as latest_date,
//           company_code
//       FROM daily_watchlist
//       WHERE company_code = 'ICICIBANK'
//       GROUP BY company_code
//     `);
    
//     if (latestResult.rows.length > 0) {
//       console.table(latestResult.rows);
//     } else {
//       console.log('No data found');
//     }

//     // Query 3: Check if company exists at all
//     console.log('\n🏢 CHECK IF ICICIBANK EXISTS IN COMPANIES TABLE:');
//     console.log('='.repeat(60));
//     const companyCheck = await client.query(`
//       SELECT * FROM companies WHERE company_code = 'ICICIBANK'
//     `);
    
//     if (companyCheck.rows.length === 0) {
//       console.log('❌ ICICIBANK NOT FOUND in companies table');
//     } else {
//       console.log('✅ Found in companies table:');
//       console.table(companyCheck.rows);
//     }

//   } catch (error) {
//     console.error('❌ Error:', error);
//   } finally {
//     await client.end();
//   }
// }

// checkICICIBANK();


const { Client } = require('pg');

async function checkAXISBANK() {
  const client = new Client({
    host: '100.93.172.21',
    port: 5432,
    user: 'readonly_user',
    password: 'db_read_5432',
    database: 'nse_hist_db',
    ssl: {
      rejectUnauthorized: false, // use this if remote server doesn't have SSL certs
    },
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Query 1: All dates when AXISBANK is in watchlist
    console.log('📅 ALL DATES WHEN AXISBANK IS IN WATCHLIST:');
    console.log('='.repeat(60));
    const result = await client.query(`
      SELECT 
          dw.watchlist_date,
          dw.company_code,
          dw.exchange,
          c.name,
          dw.created_at
      FROM daily_watchlist dw
      LEFT JOIN companies c ON dw.company_id = c.company_id
      WHERE dw.company_code = 'AXISBANK'
      ORDER BY dw.watchlist_date DESC
    `);

    if (result.rows.length === 0) {
      console.log('❌ AXISBANK NOT FOUND in daily_watchlist table');
    } else {
      console.log(`✅ Found ${result.rows.length} entries:\n`);
      console.table(result.rows);
    }

    // Query 2: Latest date
    console.log('\n📌 LATEST DATE:');
    console.log('='.repeat(60));
    const latestResult = await client.query(`
      SELECT 
          MAX(watchlist_date) as latest_date,
          company_code
      FROM daily_watchlist
      WHERE company_code = 'AXISBANK'
      GROUP BY company_code
    `);
    
    if (latestResult.rows.length > 0) {
      console.table(latestResult.rows);
    } else {
      console.log('No data found');
    }

    // Query 3: Check if company exists in companies table
    console.log('\n🏢 CHECK IF AXISBANK EXISTS IN COMPANIES TABLE:');
    console.log('='.repeat(60));
    const companyCheck = await client.query(`
      SELECT * FROM companies WHERE company_code = 'AXISBANK'
    `);
    
    if (companyCheck.rows.length === 0) {
      console.log('❌ AXISBANK NOT FOUND in companies table');
    } else {
      console.log('✅ Found in companies table:');
      console.table(companyCheck.rows);
    }

    // Query 4: Date range (earliest and latest watchlist_date)
    console.log('\n📆 DATE RANGE AVAILABLE FOR AXISBANK:');
    console.log('='.repeat(60));
    const rangeResult = await client.query(`
      SELECT 
          MIN(watchlist_date) AS earliest_date,
          MAX(watchlist_date) AS latest_date
      FROM daily_watchlist
      WHERE company_code = 'AXISBANK'
    `);
    console.table(rangeResult.rows);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkAXISBANK();
