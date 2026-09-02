// Automated Database Setup Script via Node.js pg Driver
// Runs schema.sql and seeds data without needing psql CLI installed
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbConfig = {
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
};

async function runSetup() {
  console.log('=== Automated PostgreSQL Setup ===');

  // Step 1: Connect to default postgres DB to ensure tapal_db exists
  const rootClient = new Client({ ...dbConfig, database: 'postgres' });
  try {
    await rootClient.connect();
    console.log('Connected to PostgreSQL server.');

    const checkDb = await rootClient.query("SELECT 1 FROM pg_database WHERE datname = 'tapal_db'");
    if (checkDb.rows.length === 0) {
      console.log("Database 'tapal_db' does not exist. Creating...");
      await rootClient.query('CREATE DATABASE tapal_db');
      console.log("Database 'tapal_db' created successfully.");
    } else {
      console.log("Database 'tapal_db' already exists.");
    }
  } catch (err) {
    console.error('Could not connect to PostgreSQL server on localhost:5432.');
    console.error('Please verify PostgreSQL is installed & running.');
    console.error('Error details:', err.message);
    process.exit(1);
  } finally {
    await rootClient.end();
  }

  // Step 2: Connect to tapal_db & execute schema.sql
  const appClient = new Client({ ...dbConfig, database: 'tapal_db' });
  try {
    await appClient.connect();
    console.log("Connected to 'tapal_db'. Applying schema.sql...");

    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await appClient.query(schemaSql);
    console.log('Schema DDL applied successfully!');

    // Step 3: Run Seeding
    console.log('Running automatic data seed...');
    const seedScript = require('./seed_postgresql');
  } catch (err) {
    console.error('Failed to apply schema:', err.message);
  } finally {
    await appClient.end();
  }
}

if (require.main === module) {
  runSetup();
}

