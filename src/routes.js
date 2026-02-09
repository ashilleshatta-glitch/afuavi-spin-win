const express = require('express');
const router = express.Router();
const { pool } = require('./db');
const { generateDiscountCode, apiResponse, asyncHandler } = require('./utils');

// Middleware to "authenticate" (simulate)
router.use((req, res, next) => {
    next();
});

/**
 * POST /api/spin
 * The core logic for the Spin & Win system.
 */
router.post('/spin', asyncHandler(async (req, res) => {
    const { customerId } = req.body;

    if (!customerId) {
        return apiResponse(res, 400, false, null, "Customer ID is required");
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Lock the Customer Row
        const customerRes = await client.query(
            'SELECT id, has_spun, email FROM customers WHERE id = $1 FOR UPDATE',
            [customerId]
        );

        if (customerRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return apiResponse(res, 404, false, null, "Customer not found. Please register first.");
        }

        const customer = customerRes.rows[0];

        if (customer.has_spun) {
            await client.query('ROLLBACK');
            return apiResponse(res, 400, false, null, "You have already used your spin.");
        }

        // Check for Win Availability
        const limitsRes = await client.query(
            'SELECT winners_so_far, max_winners FROM campaign_limits WHERE id = 1 FOR UPDATE'
        );

        if (limitsRes.rows.length === 0) {
            throw new Error("Campaign configuration missing.");
        }

        // 1. Get Prize Tiers with remaining quota
        const tiersRes = await client.query(
            'SELECT * FROM prize_tiers WHERE winners_so_far < max_winners ORDER BY priority ASC FOR UPDATE'
        );

        let won = false;
        let discountCode = null;
        let selectedTier = null;

        if (tiersRes.rows.length > 0) {
            // Pick the highest priority available tier
            selectedTier = tiersRes.rows[0];
            won = true;
            discountCode = generateDiscountCode();

            // Update limits
            await client.query(
                'UPDATE campaign_limits SET winners_so_far = winners_so_far + 1 WHERE id = 1'
            );

            await client.query(
                'UPDATE prize_tiers SET winners_so_far = winners_so_far + 1 WHERE id = $1',
                [selectedTier.id]
            );

            // Record Redemption
            await client.query(
                `INSERT INTO redemptions 
                (discount_code, customer_id, prize_tier_id, prize_label, discount_percentage) 
                VALUES ($1, $2, $3, $4, $5)`,
                [
                    discountCode,
                    customerId,
                    selectedTier.id,
                    selectedTier.label,
                    selectedTier.discount_percentage || 1 // Fallback for pure prizes
                ]
            );
        }

        // Mark customer as having spun
        await client.query(
            'UPDATE customers SET has_spun = TRUE WHERE id = $1',
            [customerId]
        );

        // Record Spin
        await client.query(
            `INSERT INTO spins 
            (customer_id, won, prize_tier_id, prize_label, discount_percentage, discount_code) 
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                customerId,
                won,
                selectedTier ? selectedTier.id : null,
                selectedTier ? selectedTier.label : null,
                selectedTier ? selectedTier.discount_percentage : null,
                discountCode
            ]
        );

        await client.query('COMMIT');

        if (won) {
            return res.json({
                success: true,
                won: true,
                discount_code: discountCode,
                prize_label: selectedTier.label,
                message: `Congratulations! You won: ${selectedTier.label}`
            });
        } else {
            return res.json({
                success: true,
                won: false,
                discount_code: null,
                message: "Sorry, you didn't win this time."
            });
        }

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Spin Transaction Error:", error);
        return apiResponse(res, 500, false, null, "Internal server error processing spin.");
    } finally {
        client.release();
    }
}));

router.post('/redeem', asyncHandler(async (req, res) => {
    const { code } = req.body;
    if (!code) return apiResponse(res, 400, false, null, "Discount code is required");

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const redemptionRes = await client.query(
            'SELECT * FROM redemptions WHERE discount_code = $1 FOR UPDATE',
            [code]
        );

        if (redemptionRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return apiResponse(res, 404, false, null, "Invalid discount code");
        }

        const redemption = redemptionRes.rows[0];
        if (redemption.redeemed_at) { // Use redeemed_at presence as check
            await client.query('ROLLBACK');
            return apiResponse(res, 400, false, null, "Code has already been redeemed");
        }

        await client.query(
            'UPDATE redemptions SET redeemed_at = NOW() WHERE discount_code = $1',
            [code]
        );

        await client.query('COMMIT');
        return apiResponse(res, 200, true, { code }, "Code redeemed successfully");

    } catch (error) {
        await client.query('ROLLBACK');
        return apiResponse(res, 500, false, null, "Internal server error.");
    } finally {
        client.release();
    }
}));


router.post('/register', asyncHandler(async (req, res) => {
    const { email, id } = req.body;
    if (!email) return apiResponse(res, 400, false, null, "Email required");


    // Use upsert-like logic: if ID provided, insert with that ID.
    // If conflict, we assume user is already registered (idempotent).
    let query, params;
    if (id) {
        query = `
            INSERT INTO customers (id, email) VALUES ($1, $2) 
            ON CONFLICT (id) DO NOTHING 
            RETURNING *
        `;
        params = [id, email];
    } else {
        query = 'INSERT INTO customers (email) VALUES ($1) RETURNING *';
        params = [email];
    }

    const result = await pool.query(query, params);

    // If INSERT was skipped (DO NOTHING), we don't return a row. 
    // That's fine, we just return success.
    const customer = result.rows[0] || { id, email, existing: true };

    return apiResponse(res, 201, true, customer, "Customer registered");
}));

// --- ADMIN ENDPOINTS ---

/**
 * GET /api/admin/winners
 * Securely fetch all winners for the dashboard
 */
router.get('/admin/winners', asyncHandler(async (req, res) => {
    // Get winners
    const winnersRes = await pool.query(`
        SELECT 
            s.id, c.email, s.prize_label, s.discount_code, s.created_at, r.redeemed_at
        FROM spins s
        JOIN customers c ON s.customer_id = c.id
        LEFT JOIN redemptions r ON r.discount_code = s.discount_code
        WHERE s.won = TRUE
        ORDER BY s.created_at DESC
    `);

    // Get total spins
    const statsRes = await pool.query(`
        SELECT 
            (SELECT COUNT(*) FROM spins) as total_spins,
            (SELECT COUNT(*) FROM customers) as total_customers
    `);

    return apiResponse(res, 200, true, {
        winners: winnersRes.rows,
        stats: statsRes.rows[0]
    }, "Data fetched successfully");
}));

/**
 * POST /api/admin/redeem
 * Manually mark a code as redeemed by the admin
 */
router.post('/admin/redeem', asyncHandler(async (req, res) => {
    const { discount_code } = req.body;

    if (!discount_code) {
        return apiResponse(res, 400, false, null, "Discount code is required.");
    }

    await pool.query(
        'UPDATE redemptions SET redeemed_at = NOW() WHERE discount_code = $1',
        [discount_code]
    );

    return apiResponse(res, 200, true, null, "Prize marked as redeemed.");
}));

module.exports = router;



