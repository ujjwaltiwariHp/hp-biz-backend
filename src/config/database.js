const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    require: true,
    rejectUnauthorized: false,
  },
  max: 10,
  idleTimeoutMillis: 2000,
  connectionTimeoutMillis: 30000,
  allowExitOnIdle: false,
  keepAlive: true
});

pool.on('connect', () => {
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err.message);
});

module.exports = pool;