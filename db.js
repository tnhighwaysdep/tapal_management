// PostgreSQL Database Module for TN Government Inward Tapal System
const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL Connection Pool Config (Supports Local & Supabase Cloud PostgreSQL)
const isCloudDb = process.env.PGHOST?.includes('supabase') || process.env.DATABASE_URL?.includes('supabase') || process.env.PGSSL === 'true';

const poolConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, ssl: isCloudDb ? { rejectUnauthorized: false } : false }
  : {
      host: process.env.PGHOST || 'localhost',
      port: process.env.PGPORT || 5432,
      database: process.env.PGDATABASE || 'postgres',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      ssl: isCloudDb ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

const pool = new Pool(poolConfig);

pool.on('connect', () => {
  console.log('Connected to PostgreSQL Database pool successfully.');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

// Database Query helper with automated audit logging
async function query(text, params, userId = null, action = null) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;

  // Log execution metrics for high-efficiency monitoring
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PG Query] ${text.substring(0, 80)}... | Duration: ${duration}ms | Rows: ${res.rowCount}`);
  }

  // Audit trail insertion for audit compliance
  if (action && userId) {
    try {
      await pool.query(
        'INSERT INTO tapal_audit_logs (user_id, action, changes) VALUES ($1, $2, $3)',
        [userId, action, JSON.stringify({ query: text.substring(0, 100), rowCount: res.rowCount })]
      );
    } catch (auditErr) {
      console.error('Failed to record audit log:', auditErr);
    }
  }

  return res;
}

module.exports = {
  pool,
  query
};
