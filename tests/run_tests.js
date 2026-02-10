
const { spawn } = require('child_process');

async function runTests() {
    console.log('--- Starting Integration Tests ---');

    const BASE_URL = 'http://localhost:3000/api';

    // Helper for requests
    async function request(endpoint, method = 'GET', body = null) {
        try {
            const options = {
                method,
                headers: { 'Content-Type': 'application/json' },
            };
            if (body) options.body = JSON.stringify(body);

            const res = await fetch(`${BASE_URL}${endpoint}`, options);
            const text = await res.text();
            try {
                const data = JSON.parse(text);
                return { status: res.status, data };
            } catch (err) {
                console.error(`Request to ${endpoint} returned non-JSON response:`);
                console.error(text.slice(0, 500)); // Log first 500 chars
                return { status: res.status, data: null, raw: text };
            }
        } catch (e) {
            console.error(`Request to ${endpoint} failed:`, e.message);
            return null;
        }
    }

    // 1. Register User
    const email = `test_${Date.now()}@example.com`;
    console.log(`\n1. Registering new user: ${email}`);
    const reg = await request('/register', 'POST', { email });

    if (!reg || !reg.data.success) {
        console.error('FAILED: Registration failed');
        console.error(reg);
        return; // specific fail
    }

    console.log('Registration Response:', JSON.stringify(reg.data, null, 2));

    // apiResponse wrapper puts payload in 'data' field
    const customerId = reg.data.data && reg.data.data.id;
    console.log('PASSED: User registered', customerId);

    if (!customerId) {
        console.error("FATAL: No customer ID returned");
        return;
    }

    // 2. Spin
    console.log(`\n2. Attempting to spin for: ${customerId}`);
    const spin = await request('/spin', 'POST', { customerId });

    if (!spin || !spin.data.success) {
        console.error('FAILED: Spin failed or already spun');
        console.error(spin);
    } else {
        console.log(`PASSED: Spin successful. Result: ${spin.data.won ? 'WIN' : 'LOSS'}`);

        if (spin.data.won) {
            const code = spin.data.discount_code;
            console.log(`Won Code: ${code}`);

            // 3. Redeem (if won)
            console.log(`\n3. Redeeming code: ${code}`);
            const redeem = await request('/redeem', 'POST', { code });

            if (redeem && redeem.data.success) {
                console.log('PASSED: Redemption successful');
            } else {
                console.error('FAILED: Redemption failed', redeem);
            }

            // 4. Try redeeming again (should fail)
            console.log(`\n4. Redeeming code again (should fail): ${code}`);
            const redeem2 = await request('/redeem', 'POST', { code });
            if (redeem2 && !redeem2.data.success) {
                console.log('PASSED: Double redemption prevented');
            } else {
                console.error('FAILED: Double redemption allowed!', redeem2);
            }
        }
    }

    // 5. Try spinning again (should fail)
    console.log(`\n5. Attempting to spin again (should fail): ${customerId}`);
    const spin2 = await request('/spin', 'POST', { customerId });
    if (spin2 && !spin2.data.success) {
        console.log('PASSED: Double spin prevented');
    } else {
        console.error('FAILED: Double spin allowed!', spin2);
    }

    console.log('\n--- Tests Completed ---');
}

// Check if server is running
fetch('http://localhost:3000')
    .then(() => {
        runTests();
    })
    .catch(() => {
        console.log('Server is NOT running. Starting server for testing...');
        const server = spawn('npm', ['start'], { shell: true, stdio: 'pipe' }); // stdio pipe to ignore logs or grab them

        let started = false;

        server.stdout.on('data', (data) => {
            const output = data.toString();
            // console.log('[Server]:', output);
            if (output.includes('Server running') && !started) {
                started = true;
                // Give it a moment
                setTimeout(() => {
                    runTests().then(() => {
                        console.log('Killing test server...');
                        server.kill(); // This might not kill the tree on windows easily, but sufficient for now
                        process.exit(0);
                    });
                }, 1000);
            }
        });

        server.stderr.on('data', (data) => console.error('[Server Error]:', data.toString()));
    });
