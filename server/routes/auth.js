'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, requireAuth, publicUser } = require('../middleware/auth');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', (req, res) => {
  const store = db.load();
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const phone = String(req.body.phone || '').trim();

  if (name.length < 2) {
    return res.status(400).json({ message: 'Please enter your full name.' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ message: 'Please enter a valid email address.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
  }
  if (store.users.some((u) => u.email === email)) {
    return res.status(409).json({ message: 'An account with this email already exists. Try signing in.' });
  }

  const user = {
    _id: db.nextId('user'),
    name,
    email,
    passwordHash: bcrypt.hashSync(password, 10),
    phone,
    address: '',
    role: 'customer',
    createdAt: new Date().toISOString()
  };

  store.users.push(user);
  db.save();

  return res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const store = db.load();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!email || !password) {
    return res.status(400).json({ message: 'Enter your email and password to continue.' });
  }

  const user = store.users.find((u) => u.email === email);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ message: 'Incorrect email or password.' });
  }

  return res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.put('/profile', requireAuth, (req, res) => {
  const store = db.load();
  const user = store.users.find((u) => u._id === req.user._id);

  const name = String(req.body.name || '').trim();
  if (name && name.length < 2) {
    return res.status(400).json({ message: 'Please enter your full name.' });
  }
  if (req.body.phone !== undefined) {
    const phone = String(req.body.phone).trim();
    if (phone && !/^[0-9+\-\s]{10,15}$/.test(phone)) {
      return res.status(400).json({ message: 'Please enter a valid phone number.' });
    }
    user.phone = phone;
  }

  if (name) user.name = name;
  if (req.body.address !== undefined) user.address = String(req.body.address).trim();

  db.save();
  return res.json({ user: publicUser(user) });
});

module.exports = router;
