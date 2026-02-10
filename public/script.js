document.addEventListener('DOMContentLoaded', () => {
    const spinBtn = document.getElementById('spinBtn');
    const wheelOuter = document.getElementById('wheelOuter');
    const resultModal = document.getElementById('resultModal');
    const resultTitle = document.getElementById('resultTitle');
    const resultMessage = document.getElementById('resultMessage');
    const discountSection = document.getElementById('discountSection');
    const redemptionSection = document.getElementById('redemptionSection');
    const discountCodeEl = document.getElementById('discountCode');
    const redemptionCodeEl = document.getElementById('redemptionCode');

    // State
    let isSpinning = false;
    let hasSpun = localStorage.getItem('hasSpun') === 'true';

    // Initial Check
    if (hasSpun) {
        disableSpinButton();
    }

    // --- REAL API INTEGRATION ---

    // Helper to get a stable User ID for this browser
    function getCustomerId() {
        let id = localStorage.getItem('spin_demo_user_id');
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem('spin_demo_user_id', id);
            registerUser(id);
        }
        return id;
    }

    // Register user ensuring ID matches frontend (fixes FK issues)
    async function registerUser(uuid) {
        try {
            await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Send BOTH id and email so backend uses OUR id
                body: JSON.stringify({
                    id: uuid,
                    email: `guest_${uuid.substring(0, 8)}@example.com`
                })
            });
        } catch (e) {
            // Ignore error if already registered
            console.log("Auto-reg check", e);
        }
    }

    // Handle Spin
    spinBtn.addEventListener('click', async () => {
        if (isSpinning || hasSpun) return;

        const customerId = getCustomerId();
        isSpinning = true;
        spinBtn.disabled = true;
        spinBtn.textContent = "Spinning...";

        try {
            // 2. Make API Call
            const response = await fetch('/api/spin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Spin failed");
            }

            const data = await response.json();
            const resultData = {
                status: data.won ? 'win' : 'lose',
                discount_code: data.discount_code,
                redemption_code: data.discount_code,
                prize_description: data.prize_label
            };

            // 3. Map Prize to Wheel Segment
            // Segments are 1-indexed (1-8)
            // 1: 50%, 2: Lose, 3: 20%, 4: Lose, 5: 10%, 6: Lose, 7: Chocolate, 8: Lose
            let targetIndex;

            if (resultData.status === 'win') {
                const prizeToSegment = {
                    '30% Off': 1,
                    '20% Off': 3,
                    '10% Off': 5,
                    '5% Off': 6,
                    'Box of Chocolate': 7
                };
                targetIndex = prizeToSegment[data.prize_label] || 1;
            } else {
                const loseIndices = [2, 4, 8];
                targetIndex = loseIndices[Math.floor(Math.random() * loseIndices.length)];
                resultData.prize_description = null;
            }

            // Calculate Rotation
            const segmentCenterAngle = (45 * targetIndex) - 22.5;
            const amountToRotate = 360 - segmentCenterAngle;

            // Add 5 full spins (1800 deg) + random jitter (+/- 15deg)
            const jitter = Math.floor(Math.random() * 30) - 15;
            const totalRotation = 1800 + amountToRotate + jitter;

            // Apply Rotation
            wheelOuter.style.transform = `rotate(${totalRotation}deg)`;

            // 4. Wait for animation
            setTimeout(() => {
                handleResult(resultData);
            }, 4000); // Must match CSS transition duration

        } catch (err) {
            console.error("Spin failed", err);
            spinBtn.disabled = false;
            spinBtn.textContent = "Spin Now";
            isSpinning = false;
            alert(err.message || "Something went wrong. Please try again.");
        }
    });

    function handleResult(data) {
        isSpinning = false;
        hasSpun = true;
        localStorage.setItem('hasSpun', 'true');
        disableSpinButton();

        if (data.status === 'win') {
            resultTitle.textContent = "YOU WON!";
            resultTitle.className = "result-title win-text";
            resultMessage.textContent = `Amazing! You've won: ${data.prize_description}`;
            redemptionSection.classList.remove('hidden');
            redemptionCodeEl.textContent = data.redemption_code;
        } else {
            resultTitle.textContent = "SO CLOSE!";
            resultTitle.className = "result-title lose-text";
            resultMessage.textContent = "Better luck next time! Here's a consolation discount for you.";
            redemptionSection.classList.add('hidden');
        }

        discountCodeEl.textContent = data.discount_code || "LOVE10";
        resultModal.classList.add('active');
        resultModal.scrollIntoView({ behavior: 'smooth' });
    }

    function disableSpinButton() {
        spinBtn.disabled = true;
        spinBtn.textContent = "Already Spun";
        spinBtn.classList.add('disabled');
    }

    window.copyToClipboard = (elementId) => {
        const minText = document.getElementById(elementId).textContent;
        navigator.clipboard.writeText(minText).then(() => {
            alert("Code copied to clipboard!");
        });
    }

    // Trigger registration check on load
    getCustomerId();
});
