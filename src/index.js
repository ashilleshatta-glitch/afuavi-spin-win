const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();

const routes = require('./routes');
const { apiResponse } = require('./utils');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet());
app.use(cors()); // Configure origin in production
app.use(express.json());
app.use(express.static('public')); // Serve frontend files


// Routes
app.use('/api', routes);

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    apiResponse(res, 500, false, null, process.env.NODE_ENV === 'development' ? err.message : "Internal Server Error");
});

// 404 Handler
app.use((req, res) => {
    apiResponse(res, 404, false, null, "Route not found");
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
