require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Import routes
const checkoutRoutes = require('./routes/checkout');
const licenseRoutes = require('./routes/license');
const webhookRoutes = require('./routes/webhook');

// Middleware
app.use(cors());
// Parse JSON bodies and keep a copy of the raw body (useful for verifying PayPal webhook signatures)
app.use(express.json({
  verify: (req, res, buf) => {
    if (buf && buf.length) {
      req.rawBody = buf.toString();
    }
  }
}));
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api/checkout', checkoutRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/webhook', webhookRoutes);

// Serve the main index.html for any other routes (SPA)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

module.exports = app;