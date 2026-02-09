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

// Explicitly serve admin page
app.get('/admin', (req, res) => {
    res.sendFile('admin.html', { root: 'public' });
});

// Catch-all route - serve index.html for any non-API route
app.get('*', (req, res) => {
    res.sendFile('index.html', { root: 'public' });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}

