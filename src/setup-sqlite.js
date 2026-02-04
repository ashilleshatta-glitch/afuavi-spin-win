
const { pool } = require('./db');
const fs = require('fs');
const path = require('path');

// SQLite specific setup script content
// We need to adjust standard SQL to SQLite (e.g. Serial -> Integer Primary Key, timestamps, etc)
// Since we are mocking, we will just create the tables manually in code for SQLite
// or write a compatible schema file.

async function setupSqlite() {
    console.log('Initializing SQLite Database...');
    const client = await pool.connect();

    // 1. Campaign Limits
    await client.query(`
        CREATE TABLE IF NOT EXISTS campaign_limits (
            id INTEGER PRIMARY KEY,
            max_winners INTEGER NOT NULL DEFAULT 15,
            winners_so_far INTEGER NOT NULL DEFAULT 0
        );
    `);

    await client.query(`
        INSERT OR IGNORE INTO campaign_limits (id, max_winners, winners_so_far)
        VALUES (1, 15, 0);
    `);

    // 2. Customers
    await client.query(`
        CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            has_spun INTEGER DEFAULT 0 -- SQLite uses 0/1 for boolean
        );
    `);

    // 3. Redemptions
    await client.query(`
        CREATE TABLE IF NOT EXISTS redemptions (
            code TEXT PRIMARY KEY,
            customer_id TEXT NOT NULL,
            is_redeemed INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            redeemed_at TEXT,
            FOREIGN KEY(customer_id) REFERENCES customers(id)
        );
    `);

    // 4. Spins
    await client.query(`
        CREATE TABLE IF NOT EXISTS spins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id TEXT NOT NULL,
            result TEXT CHECK(result IN ('WIN', 'LOSS')) NOT NULL,
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(customer_id) REFERENCES customers(id)
        );
    `);

    console.log('SQLite Schema Created.');
}

setupSqlite().catch(err => {
    console.error(err);
    process.exit(1);
});
