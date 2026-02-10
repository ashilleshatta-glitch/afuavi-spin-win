const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();

const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Routes
app.use('/api', routes);

// Explicitly serve admin page
app.get('/admin', (req, res) => {
    res.sendFile('admin.html', { root: 'public' });
});

// Catch-all route
app.get('*', (req, res) => {
    res.sendFile('index.html', { root: 'public' });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
