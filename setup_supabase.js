// Automated Supabase Database Setup & Seeding Script
// Applies schema.sql and seeds all initial tapal records into Supabase PostgreSQL
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Parse connection string or individual environment parameters
function getSupabaseConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    };
  }

  const host = process.env.PGHOST || process.env.SUPABASE_DB_HOST;
  const password = process.env.PGPASSWORD || process.env.SUPABASE_DB_PASSWORD;
  const user = process.env.PGUSER || process.env.SUPABASE_DB_USER || 'postgres';
  const database = process.env.PGDATABASE || 'postgres';
  const port = process.env.PGPORT || 5432;

  if (!host || !password) {
    console.error('\n❌ Supabase database connection details missing in environment / .env file!');
    console.error('Please configure your .env file with your Supabase credentials:\n');
    console.error('Option 1 (Connection String):');
    console.error('DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres"\n');
    console.error('Option 2 (Individual Config):');
    console.error('PGHOST=db.[PROJECT_REF].supabase.co');
    console.error('PGUSER=postgres');
    console.error('PGPASSWORD=your-db-password');
    console.error('PGDATABASE=postgres');
    console.error('PGPORT=5432\n');
    process.exit(1);
  }

  return {
    host,
    port: parseInt(port, 10),
    user,
    password,
    database,
    ssl: { rejectUnauthorized: false }
  };
}

// Parse INITIAL_TAPAL_DATA from data.js
function parseDataFile() {
  const fileContent = fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8');
  const jsonMatch = fileContent.match(/const INITIAL_TAPAL_DATA = (\[[\s\S]*?\]);/);
  if (!jsonMatch) {
    throw new Error('Failed to parse INITIAL_TAPAL_DATA from data.js');
  }
  return JSON.parse(jsonMatch[1]);
}

async function runSupabaseSetup() {
  console.log('\n======================================================');
  console.log('🚀 TN Government Tapal System - Supabase Database Setup');
  console.log('======================================================\n');

  const config = getSupabaseConfig();
  const client = new Client(config);

  try {
    console.log('🔌 Connecting to Supabase PostgreSQL database...');
    await client.connect();
    console.log('✅ Successfully connected to Supabase!');

    // Step 1: Read and execute schema.sql
    console.log('\n📜 Applying schema.sql (Tables, RLS, Search Vectors, Indexes)...');
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schemaSql);
    console.log('✅ Schema DDL applied successfully to Supabase!');

    // Step 2: Seed tapal_register table
    console.log('\n📦 Seeding tapal_register from data.js...');
    const records = parseDataFile();
    console.log(`Parsed ${records.length} records from data.js.`);

    // Truncate tapal_register table for a clean seed
    await client.query('TRUNCATE TABLE tapal_register RESTART IDENTITY CASCADE');

    let inserted = 0;
    for (const r of records) {
      const sql = `
        INSERT INTO tapal_register (
          s_no, month_year, tapal_type, curr_no, office_seal_date, received_sec_date,
          subject, letter_ref, letter_date, short_sub, main_office, officer_desig,
          status, action_initiated, file_no_ref, file_init_date, file_appr_date,
          follow_up, follow_up_date, follow_up_closed_date, follow_up_status, remarks, tech_sec_ref, section,
          emp_desig, sent_letter_no, accounts_ref_no, dispatch_date, sent_to
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
      `;

      const values = [
        r.sNo || inserted + 1,
        r.month || 'FEB-2023',
        r.tapalType || 'Tapal',
        r.currNo ? parseInt(r.currNo, 10) : 0,
        r.sealDate && r.sealDate !== '' ? r.sealDate : null,
        r.recSecDate && r.recSecDate !== '' ? r.recSecDate : '2023-02-01',
        r.subject || 'N/A',
        r.letterRef ? String(r.letterRef) : null,
        r.letterDate && r.letterDate !== '' ? r.letterDate : null,
        r.shortSub || null,
        r.mainOffice || 'CE',
        r.officerDesig || 'General',
        r.status || 'Pending',
        r.actionInitiated || null,
        r.fileNoRef || null,
        r.fileInitDate && r.fileInitDate !== '' ? r.fileInitDate : null,
        r.fileApprDate && r.fileApprDate !== '' ? r.fileApprDate : null,
        r.followUp || null,
        r.followUpDate && r.followUpDate !== '' ? r.followUpDate : null,
        r.followUpClosedDate && r.followUpClosedDate !== '' ? r.followUpClosedDate : null,
        r.followUpStatus || 'Open',
        r.remarks || null,
        r.techSecRef || null,
        r.section || 'Planning/Budget',
        r.empDesig || null,
        r.sentLetterNo ? String(r.sentLetterNo) : null,
        r.accountsRefNo ? String(r.accountsRefNo) : null,
        r.dispatchDate && r.dispatchDate !== '' ? r.dispatchDate : null,
        r.sentTo || null
      ];

      await client.query(sql, values);
      inserted++;
    }

    console.log(`✅ Successfully seeded ${inserted} records into Supabase PostgreSQL!`);

    // Step 3: Verify counts
    const officeCount = await client.query('SELECT COUNT(*) FROM offices');
    const userCount = await client.query('SELECT COUNT(*) FROM users');
    const tapalCount = await client.query('SELECT COUNT(*) FROM tapal_register');
    const customOptCount = await client.query('SELECT COUNT(*) FROM custom_dropdown_options');

    console.log('\n📊 Database Metrics in Supabase:');
    console.log(`   • Offices: ${officeCount.rows[0].count}`);
    console.log(`   • Users/Officers: ${userCount.rows[0].count}`);
    console.log(`   • Tapal Register Records: ${tapalCount.rows[0].count}`);
    console.log(`   • Custom Dropdown Options: ${customOptCount.rows[0].count}`);
    console.log('\n🎉 Supabase Database Setup & Data Seeding Complete!\n');

  } catch (err) {
    console.error('❌ Supabase Setup Failed:', err.message);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  runSupabaseSetup();
}

module.exports = runSupabaseSetup;
