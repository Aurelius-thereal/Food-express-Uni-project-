'use strict';

const jwt = require('jsonwebtoken');
const db = require('../db');

const SECRET = process.env.JWT_SECRET || 'foodexpress-dev-secret-change-me';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, SECRET, { expiresIn: EXPIRES_IN });
}

function publicUser(user) {
  if (!user) return null;
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    address: user.address || '',
    role: user.role,
    createdAt: user.createdAt
  };
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.indexOf('Bearer ') === 0 ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Please sign in to continue.' });
  }

  try {
    const payload = jwt.verify(token, SECRET);
    const user = db.load().users.find((u) => String(u._id) === String(payload.id));
    if (!user) {
      return res.status(401).json({ message: 'Your account is no longer available.' });
    }
    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access is required for this action.' });
  }
  return next();
}

module.exports = { SECRET, signToken, requireAuth, adminOnly, publicUser };
