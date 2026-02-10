
const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function setupDatabase() {
    try {
        const sqlPath = path.join(__dirname, '..', 'setup.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Running setup.sql...');
        await pool.query(sql);
        console.log('Database setup completed successfully.');
    } catch (err) {
        console.error('Error setting up database:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

setupDatabase();
