'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.disable('x-powered-by');
app.use(express.json({ limit: '200kb' }));

// Fail fast with a clear message instead of a silent 500 on bad JSON.
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body must be valid JSON.' });
  }
  return next(err);
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/restaurants', require('./routes/restaurants'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/admin', require('./routes/admin'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
});

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'API endpoint not found.' });
  }
  return res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Central error handler so every failure returns JSON the SPA can display.
app.use((err, req, res, next) => {
  console.error('[server]', err);
  const status = err.status || 500;
  res.status(status).json({ message: err.message || 'Something went wrong. Please try again.' });
});

const store = db.load();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`FoodExpress running at http://localhost:${PORT}`);
  console.log(`  ${store.restaurants.length} restaurants · ${store.items.length} menu items · ${store.orders.length} orders`);
});
