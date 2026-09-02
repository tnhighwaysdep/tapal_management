// PostgreSQL Database Module for TN Government Inward Tapal System
const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL Connection Pool Config (Supports Local & Supabase Cloud PostgreSQL)
let connectionUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
if (connectionUrl) {
  // Strip sslmode query parameter to prevent pg internal parser from forcing strict SSL validation
  connectionUrl = connectionUrl.replace(/([?&])sslmode=[^&]+(&|$)/g, '$1').replace(/[?&]$/, '');
}

const poolConfig = connectionUrl
  ? {
      connectionString: connectionUrl,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  : {
      host: process.env.PGHOST || process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.PGPORT || process.env.POSTGRES_PORT || 5432, 10),
      database: process.env.PGDATABASE || process.env.POSTGRES_DATABASE || 'postgres',
      user: process.env.PGUSER || process.env.POSTGRES_USER || 'postgres',
      password: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
      ssl: (!process.env.PGHOST || process.env.PGHOST === 'localhost' || process.env.PGHOST === '127.0.0.1')
        ? false
        : { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
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
