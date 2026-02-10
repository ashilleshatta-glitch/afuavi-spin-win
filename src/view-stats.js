const { pool } = require('./db');

async function viewDatabaseStats() {
    try {
        console.log('\n=== DATABASE STATISTICS ===\n');

        // 1. Campaign Limits (Winners Count)
        const limitsResult = await pool.query('SELECT * FROM campaign_limits WHERE id = 1');
        if (limitsResult.rows.length > 0) {
            const { max_winners, winners_so_far } = limitsResult.rows[0];
            console.log('📊 CAMPAIGN STATUS:');
            console.log(`   Winners so far: ${winners_so_far} / ${max_winners}`);
            console.log(`   Remaining slots: ${max_winners - winners_so_far}`);
            console.log('');
        }

        // 2. Total Customers
        const customersResult = await pool.query('SELECT COUNT(*) as total FROM customers');
        console.log('👥 CUSTOMERS:');
        console.log(`   Total registered: ${customersResult.rows[0].total}`);

        const spunResult = await pool.query('SELECT COUNT(*) as total FROM customers WHERE has_spun = TRUE');
        console.log(`   Have spun: ${spunResult.rows[0].total}`);
        console.log('');

        // 3. Spins Breakdown
        const spinsResult = await pool.query(`
            SELECT 
                CASE WHEN won = TRUE THEN 'WIN' ELSE 'LOSS' END as result,
                COUNT(*) as count 
            FROM spins 
            GROUP BY won
        `);
        console.log('🎰 SPINS BREAKDOWN:');
        spinsResult.rows.forEach(row => {
            console.log(`   ${row.result}: ${row.count}`);
        });
        console.log('');

        // 4. Recent Winners (Last 10)
        const winnersResult = await pool.query(`
            SELECT c.email, s.created_at as timestamp, r.discount_code as code
            FROM spins s
            JOIN customers c ON s.customer_id = c.id
            LEFT JOIN redemptions r ON r.customer_id = c.id
            WHERE s.won = TRUE
            ORDER BY s.created_at DESC
            LIMIT 10
        `);

        if (winnersResult.rows.length > 0) {
            console.log('🏆 RECENT WINNERS:');
            winnersResult.rows.forEach((winner, index) => {
                const timestamp = new Date(winner.timestamp).toLocaleString();
                console.log(`   ${index + 1}. ${winner.email}`);
                console.log(`      Code: ${winner.code || 'N/A'}`);
                console.log(`      Time: ${timestamp}`);
            });
        } else {
            console.log('🏆 RECENT WINNERS: None yet');
        }
        console.log('');

        // 5. Redemptions
        const redemptionsResult = await pool.query(`
            SELECT COUNT(*) as total FROM redemptions WHERE redeemed_at IS NOT NULL
        `);
        console.log('💰 REDEMPTIONS:');
        console.log(`   Codes redeemed: ${redemptionsResult.rows[0].total}`);
        console.log('');

        console.log('=== END OF REPORT ===\n');

    } catch (error) {
        console.error('Error fetching database stats:', error.message);
    } finally {
        await pool.end();
    }
}

viewDatabaseStats();
