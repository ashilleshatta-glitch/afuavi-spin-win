
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

// Maintain a single database connection promise (singleton-ish)
let dbPromise;

async function getDb() {
    if (!dbPromise) {
        dbPromise = open({
            filename: path.join(__dirname, '..', 'database.sqlite'),
            driver: sqlite3.Database
        });
    }
    return dbPromise;
}

// Emulate Postgres Pool.query signature for compatibility
const pool = {
    query: async (text, params) => {
        const db = await getDb();

        // Convert Postgres $1, $2 syntax to SQLite ? syntax
        let sql = text;
        const normalizedParams = params || [];

        // Simple replace $n with ?
        // Note: This is a basic conversion and might break on complex strings containing $
        if (normalizedParams.length > 0) {
            sql = sql.replace(/\$\d+/g, '?');
        }

        // SQLite 'RUN' for Insert/Update, 'ALL' for Select
        const isSelect = /^\s*SELECT/i.test(sql);
        const isInsert = /^\s*INSERT/i.test(sql) || /^\s*UPDATE/i.test(sql) || /^\s*DELETE/i.test(sql);

        try {
            if (isSelect) {
                const rows = await db.all(sql, normalizedParams);
                return { rows, rowCount: rows.length };
            } else {
                const result = await db.run(sql, normalizedParams);
                // Emulate RETURNING * which SQLite doesn't support natively easily in same call usually,
                // but for simple cases we might just return the ID.
                // However, our code relies on RETURNING slightly.
                // For now, we return basic info. 
                return { rows: [], rowCount: result.changes };
            }
        } catch (err) {
            console.error("SQL Error:", err.message, "Query:", sql);
            throw err;
        }
    },
    // Mock other pool methods
    connect: async () => {
        const client = {
            query: pool.query,
            release: () => { } // No-op for SQLite
        };
        return client;
    },
    end: async () => {
        const db = await getDb();
        await db.close();
    }
};


module.exports = {
    pool,
    query: pool.query,
};
