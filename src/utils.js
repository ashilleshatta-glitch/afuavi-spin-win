const { customAlphabet } = require('nanoid');
const crypto = require('crypto');

// Generate a secure, unique discount code
// Using a custom alphabet to avoid ambiguous characters
const alphabet = '2346789ABCDEFGHJKLMNPQRTUVWXYZ';
const nanoid = customAlphabet(alphabet, 12);

function generateDiscountCode() {
    return `WIN-${nanoid()}`;
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
