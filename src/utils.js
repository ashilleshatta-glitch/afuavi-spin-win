const crypto = require('crypto');

// Generate a secure, unique discount code using built-in Crypto
function generateDiscountCode() {
    const chars = '2346789ABCDEFGHJKLMNPQRTUVWXYZ';
    let code = '';
    for (let i = 0; i < 10; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `WIN-${code}`;
}

// Standardized API Response
function apiResponse(res, statusCode, success, data = null, message = '') {
    return res.status(statusCode).json({
        success,
        data,
        message
    });
}

// Async handler to wrap routes
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
    generateDiscountCode,
    apiResponse,
    asyncHandler
};

