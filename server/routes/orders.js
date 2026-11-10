'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const GST_PERCENT = Number(process.env.GST_PERCENT || 5);
const DELIVERY_FEE = Number(process.env.DELIVERY_FEE || 29);
const FREE_DELIVERY_ABOVE = Number(process.env.FREE_DELIVERY_ABOVE || 499);

const PAYMENT_METHODS = ['Cash on Delivery', 'Card', 'UPI'];
const ACTIVE_STATUSES = ['Placed', 'Confirmed', 'Preparing', 'Out for Delivery'];
const CANCELLABLE = ['Placed', 'Confirmed', 'Preparing'];

function totalsFor(subtotal) {
  const gst = Math.round((subtotal * GST_PERCENT) / 100);
  const deliveryFee = subtotal >= FREE_DELIVERY_ABOVE ? 0 : DELIVERY_FEE;
  return { gst, deliveryFee, total: subtotal + gst + deliveryFee };
}

function ownOrder(store, id, user) {
  const order = store.orders.find((o) => String(o._id) === String(id));
  if (!order) return { error: 404 };
  if (String(order.userId) !== String(user._id) && user.role !== 'admin') return { error: 403 };
  return { order };
}

router.post('/', requireAuth, (req, res) => {
  const store = db.load();
  const body = req.body || {};
  const rawItems = Array.isArray(body.items) ? body.items : [];
  const address = String(body.address || '').trim();
  const phone = String(body.phone || '').trim();
  const paymentMethod = String(body.paymentMethod || '').trim();

  if (!rawItems.length) {
    return res.status(400).json({ message: 'Your cart is empty. Add something tasty first.' });
  }
  if (!address) {
    return res.status(400).json({ message: 'A delivery address is required to place your order.' });
  }
  if (address.length < 10) {
    return res.status(400).json({ message: 'Please enter a complete delivery address.' });
  }
  if (!/^[0-9+\-\s]{10,15}$/.test(phone)) {
    return res.status(400).json({ message: 'Please enter a valid phone number (10-15 digits).' });
  }
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    return res.status(400).json({ message: 'Choose a payment method: Cash on Delivery, Card or UPI.' });
  }

  const lineItems = [];
  let restaurantId = null;

  for (const entry of rawItems) {
    const item = store.items.find((i) => String(i._id) === String(entry.itemId));
    if (!item) {
      return res.status(400).json({ message: 'One of the items in your cart is no longer on the menu.' });
    }
    if (restaurantId === null) restaurantId = item.restaurantId;
    if (restaurantId !== item.restaurantId) {
      return res.status(400).json({ message: 'Your cart can only contain items from one restaurant.' });
    }
    const qty = Math.floor(Number(entry.qty));
    if (!Number.isFinite(qty) || qty < 1 || qty > 20) {
      return res.status(400).json({ message: `Choose a quantity between 1 and 20 for ${item.name}.` });
    }
    lineItems.push({
      itemId: item._id,
      name: item.name,
      price: item.price,
      qty,
      isVeg: item.isVeg,
      lineTotal: item.price * qty
    });
  }

  const restaurant = store.restaurants.find((r) => r._id === restaurantId);
  if (!restaurant) {
    return res.status(400).json({ message: 'That restaurant is no longer available.' });
  }
  if (!restaurant.isOpen) {
    return res.status(400).json({ message: `${restaurant.name} is currently closed. Please try another restaurant.` });
  }

  const subtotal = lineItems.reduce((sum, i) => sum + i.lineTotal, 0);
  const amount = totalsFor(subtotal);
  const now = new Date().toISOString();
  const id = db.nextId('order');

  const order = {
    _id: id,
    orderNumber: `FE-${id}`,
    userId: req.user._id,
    restaurantId,
    restaurantName: restaurant.name,
    restaurantEmoji: restaurant.emoji,
    restaurantTheme: restaurant.theme,
    items: lineItems,
    address,
    phone,
    paymentMethod,
    subtotal,
    gst: amount.gst,
    deliveryFee: amount.deliveryFee,
    total: amount.total,
    status: 'Placed',
    statusHistory: [{ status: 'Placed', at: now }],
    createdAt: now,
    updatedAt: now
  };

  store.orders.push(order);
  db.save();

  return res.status(201).json({ order });
});

router.get('/', requireAuth, (req, res) => {
  const store = db.load();
  const orders = store.orders
    .filter((o) => String(o.userId) === String(req.user._id))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((o) => Object.assign({}, o, { isActive: ACTIVE_STATUSES.includes(o.status) }));

  res.json({ orders });
});

router.get('/:id', requireAuth, (req, res) => {
  const store = db.load();
  const found = ownOrder(store, req.params.id, req.user);
  if (found.error === 404) return res.status(404).json({ message: 'Order not found.' });
  if (found.error === 403) return res.status(403).json({ message: 'You cannot view this order.' });
  return res.json({ order: found.order });
});

router.put('/:id/cancel', requireAuth, (req, res) => {
  const store = db.load();
  const found = ownOrder(store, req.params.id, req.user);
  if (found.error === 404) return res.status(404).json({ message: 'Order not found.' });
  if (found.error === 403) return res.status(403).json({ message: 'You cannot cancel this order.' });

  const order = found.order;
  if (!CANCELLABLE.includes(order.status)) {
    return res.status(400).json({
      message: `This order is already ${order.status.toLowerCase()} and can no longer be cancelled.`
    });
  }

  const now = new Date().toISOString();
  order.status = 'Cancelled';
  order.updatedAt = now;
  order.statusHistory.push({ status: 'Cancelled', at: now });
  db.save();

  return res.json({ order });
});

module.exports = router;
