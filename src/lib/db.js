import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Prevent idle client socket resets and network failures from crashing the server
pool.on('error', (err) => {
  console.error('[PostgreSQL Pool Error] Unexpected error on idle client:', err.message || err);
});

export default pool;
