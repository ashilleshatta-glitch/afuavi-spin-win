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

        const { winners_so_far, max_winners } = limitsRes.rows[0];
        const canWin = winners_so_far < max_winners;

        let result = 'LOSS';
        let discountCode = null;

        if (canWin) {
            result = 'WIN';
            discountCode = generateDiscountCode();

            await client.query(
                'UPDATE campaign_limits SET winners_so_far = winners_so_far + 1 WHERE id = 1'
            );

            await client.query(
                'INSERT INTO redemptions (code, customer_id) VALUES ($1, $2)',
                [discountCode, customerId]
            );
        }

        // Mark customer as having spun
        await client.query(
            'UPDATE customers SET has_spun = TRUE WHERE id = $1',
            [customerId]
        );

        await client.query(
            'INSERT INTO spins (customer_id, result) VALUES ($1, $2)',
            [customerId, result]
        );

        await client.query('COMMIT');

        if (result === 'WIN') {
            return res.json({
                success: true,
                won: true,
                discount_code: discountCode,
                message: "Congratulations! You won a discount."
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
            'SELECT * FROM redemptions WHERE code = $1 FOR UPDATE',
            [code]
        );

        if (redemptionRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return apiResponse(res, 404, false, null, "Invalid discount code");
        }

        const redemption = redemptionRes.rows[0];
        if (redemption.is_redeemed) {
            await client.query('ROLLBACK');
            return apiResponse(res, 400, false, null, "Code has already been redeemed");
        }

        await client.query(
            'UPDATE redemptions SET is_redeemed = TRUE, redeemed_at = NOW() WHERE code = $1',
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

module.exports = router;
