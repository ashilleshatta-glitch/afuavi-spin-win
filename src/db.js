const { Pool } = require('pg');
require('dotenv').config();

// Ensure DATABASE_URL is provided
if (!process.env.DATABASE_URL) {
  console.error("FATAL: DATABASE_URL is missing from environment variables.");
  process.exit(1);
}

// Create a new pool using the connection string
// optimize connection pooling for production
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Supabase/Heroku usually
  },
  max: 10, // Reduced max size for safety on free tier
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased to 10s to handle network latency/cold starts
});

// Test the connection
pool.on('connect', () => {
  // console.log('Connected to the database'); 
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = {
  pool,
  /**
   * Helper to execute queries
   */
  query: (text, params) => pool.query(text, params),
};
