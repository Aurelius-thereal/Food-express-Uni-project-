'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth, adminOnly, publicUser } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, adminOnly);

const THEMES = ['sunset', 'amber', 'jade', 'tomato', 'saffron', 'leaf', 'caramel', 'berry'];
const STATUSES = ['Placed', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'];
const ACTIVE_STATUSES = ['Placed', 'Confirmed', 'Preparing', 'Out for Delivery'];

/* ---------------------------------------------------------------- dashboard */

router.get('/stats', (req, res) => {
  const store = db.load();
  const paid = store.orders.filter((o) => o.status !== 'Cancelled');
  const revenue = paid.reduce((sum, o) => sum + o.total, 0);
  const today = new Date().toDateString();

  const byStatus = STATUSES.reduce((acc, status) => {
    acc[status] = store.orders.filter((o) => o.status === status).length;
    return acc;
  }, {});

  const perRestaurant = store.restaurants
    .map((r) => {
      const orders = paid.filter((o) => o.restaurantId === r._id);
      return {
        _id: r._id,
        name: r.name,
        emoji: r.emoji,
        theme: r.theme,
        orders: orders.length,
        revenue: orders.reduce((sum, o) => sum + o.total, 0)
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  res.json({
    stats: {
      revenue,
      totalOrders: store.orders.length,
      activeOrders: store.orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length,
      deliveredOrders: byStatus.Delivered,
      cancelledOrders: byStatus.Cancelled,
      todayOrders: store.orders.filter((o) => new Date(o.createdAt).toDateString() === today).length,
      customers: store.users.filter((u) => u.role === 'customer').length,
      restaurants: store.restaurants.length,
      items: store.items.length,
      averageOrderValue: paid.length ? Math.round(revenue / paid.length) : 0,
      byStatus,
      topRestaurants: perRestaurant,
      recentOrders: store.orders
        .slice()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 6)
        .map((order) => {
          const customer = store.users.find((u) => String(u._id) === String(order.userId));
          return Object.assign({}, order, { customerName: customer ? customer.name : 'Deleted user' });
        })
    }
  });
});

/* -------------------------------------------------------------- restaurants */

router.get('/restaurants', (req, res) => {
  const store = db.load();
  res.json({ restaurants: store.restaurants });
});

function restaurantPayload(body, existing) {
  const payload = Object.assign({}, existing || {});
  if (body.name !== undefined) payload.name = String(body.name).trim();
  if (body.cuisine !== undefined) payload.cuisine = String(body.cuisine).trim();
  if (body.city !== undefined) payload.city = String(body.city).trim();
  if (body.area !== undefined) payload.area = String(body.area).trim();
  if (body.description !== undefined) payload.description = String(body.description).trim();
  if (body.deliveryTime !== undefined) payload.deliveryTime = String(body.deliveryTime).trim();
  if (body.emoji !== undefined) payload.emoji = String(body.emoji).trim().slice(0, 4);
  if (body.image !== undefined) payload.image = String(body.image).trim();
  if (body.theme !== undefined && THEMES.includes(body.theme)) payload.theme = body.theme;
  if (body.rating !== undefined) payload.rating = Math.min(5, Math.max(0, Number(body.rating) || 0));
  if (body.priceForTwo !== undefined) payload.priceForTwo = Math.max(0, Number(body.priceForTwo) || 0);
  if (body.tags !== undefined) {
    payload.tags = Array.isArray(body.tags)
      ? body.tags.map((t) => String(t).trim()).filter(Boolean)
      : String(body.tags).split(',').map((t) => t.trim()).filter(Boolean);
  }
  if (body.isOpen !== undefined) payload.isOpen = Boolean(body.isOpen);
  return payload;
}

function validateRestaurant(payload) {
  if (!payload.name || payload.name.length < 2) return 'Restaurant name is required.';
  if (!payload.cuisine) return 'Cuisine type is required.';
  if (!payload.city) return 'City is required.';
  return null;
}

router.post('/restaurants', (req, res) => {
  const store = db.load();
  const payload = restaurantPayload(req.body);
  const error = validateRestaurant(payload);
  if (error) return res.status(400).json({ message: error });

  const restaurant = Object.assign(
    {
      _id: db.nextId('restaurant'),
      name: '',
      cuisine: '',
      city: '',
      area: '',
      description: '',
      deliveryTime: '30-40 min',
      rating: 4.0,
      reviews: 0,
      priceForTwo: 300,
      emoji: '🍽️',
      theme: 'sunset',
      image: '',
      tags: [],
      isOpen: true
    },
    payload
  );

  store.restaurants.push(restaurant);
  db.save();
  return res.status(201).json({ restaurant });
});

router.put('/restaurants/:id', (req, res) => {
  const store = db.load();
  const index = store.restaurants.findIndex((r) => String(r._id) === String(req.params.id));
  if (index === -1) return res.status(404).json({ message: 'Restaurant not found.' });

  const payload = restaurantPayload(req.body, store.restaurants[index]);
  const error = validateRestaurant(payload);
  if (error) return res.status(400).json({ message: error });

  store.restaurants[index] = payload;
  db.save();
  return res.json({ restaurant: payload });
});

router.delete('/restaurants/:id', (req, res) => {
  const store = db.load();
  const index = store.restaurants.findIndex((r) => String(r._id) === String(req.params.id));
  if (index === -1) return res.status(404).json({ message: 'Restaurant not found.' });

  const removed = store.restaurants.splice(index, 1)[0];
  store.items = store.items.filter((i) => i.restaurantId !== removed._id);
  db.save();
  return res.json({ message: `${removed.name} and its menu were removed.` });
});

/* --------------------------------------------------------------- menu items */

router.get('/items', (req, res) => {
  const store = db.load();
  let items = store.items.slice();
  if (req.query.restaurantId) {
    items = items.filter((i) => String(i.restaurantId) === String(req.query.restaurantId));
  }
  res.json({ items });
});

function itemPayload(body, existing) {
  const payload = Object.assign({}, existing || {});
  if (body.name !== undefined) payload.name = String(body.name).trim();
  if (body.restaurantId !== undefined) payload.restaurantId = Number(body.restaurantId);
  if (body.category !== undefined) payload.category = String(body.category).trim() || 'Main Course';
  if (body.description !== undefined) payload.description = String(body.description).trim();
  if (body.price !== undefined) payload.price = Math.max(0, Number(body.price) || 0);
  if (body.isVeg !== undefined) payload.isVeg = Boolean(body.isVeg);
  if (body.isBestseller !== undefined) payload.isBestseller = Boolean(body.isBestseller);
  if (body.isAvailable !== undefined) payload.isAvailable = Boolean(body.isAvailable);
  return payload;
}

function validateItem(store, payload) {
  if (!payload.name || payload.name.length < 2) return 'Item name is required.';
  if (!store.restaurants.some((r) => r._id === payload.restaurantId)) return 'Choose a restaurant for this item.';
  if (!payload.price || payload.price <= 0) return 'Price must be greater than zero.';
  if (!payload.category) return 'Category is required.';
  return null;
}

router.post('/items', (req, res) => {
  const store = db.load();
  const payload = itemPayload(req.body);
  const error = validateItem(store, payload);
  if (error) return res.status(400).json({ message: error });

  const item = Object.assign(
    {
      _id: db.nextId('item'),
      restaurantId: null,
      category: 'Main Course',
      name: '',
      price: 0,
      description: '',
      isVeg: true,
      isBestseller: false,
      isAvailable: true
    },
    payload
  );

  store.items.push(item);
  db.save();
  return res.status(201).json({ item });
});

router.put('/items/:id', (req, res) => {
  const store = db.load();
  const index = store.items.findIndex((i) => String(i._id) === String(req.params.id));
  if (index === -1) return res.status(404).json({ message: 'Menu item not found.' });

  const payload = itemPayload(req.body, store.items[index]);
  const error = validateItem(store, payload);
  if (error) return res.status(400).json({ message: error });

  store.items[index] = payload;
  db.save();
  return res.json({ item: payload });
});

router.delete('/items/:id', (req, res) => {
  const store = db.load();
  const index = store.items.findIndex((i) => String(i._id) === String(req.params.id));
  if (index === -1) return res.status(404).json({ message: 'Menu item not found.' });

  const removed = store.items.splice(index, 1)[0];
  db.save();
  return res.json({ message: `${removed.name} was removed from the menu.` });
});

/* ------------------------------------------------------------------- orders */

router.get('/orders', (req, res) => {
  const store = db.load();
  let orders = store.orders.slice();
  if (req.query.status && req.query.status !== 'All') {
    orders = orders.filter((o) => o.status === req.query.status);
  }
  if (req.query.search) {
    const q = String(req.query.search).toLowerCase();
    orders = orders.filter((o) =>
      [o.orderNumber, o.restaurantName, o.address]
        .concat(o.items.map((i) => i.name))
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }

  const withCustomers = orders
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((o) => {
      const user = store.users.find((u) => String(u._id) === String(o.userId));
      return Object.assign({}, o, {
        customer: user ? { name: user.name, email: user.email, phone: user.phone } : null
      });
    });

  res.json({ orders: withCustomers });
});

router.put('/orders/:id/status', (req, res) => {
  const store = db.load();
  const order = store.orders.find((o) => String(o._id) === String(req.params.id));
  if (!order) return res.status(404).json({ message: 'Order not found.' });

  const status = String(req.body.status || '').trim();
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Choose a valid order status.' });
  }
  if (order.status === status) {
    return res.json({ order });
  }
  if (order.status === 'Delivered' || order.status === 'Cancelled') {
    return res.status(400).json({ message: `This order is already ${order.status.toLowerCase()} and cannot be updated.` });
  }

  const now = new Date().toISOString();
  order.status = status;
  order.updatedAt = now;
  order.statusHistory.push({ status, at: now });
  db.save();

  return res.json({ order });
});

/* -------------------------------------------------------------------- users */

router.get('/users', (req, res) => {
  const store = db.load();
  const users = store.users.map((u) => {
    const orders = store.orders.filter((o) => String(o.userId) === String(u._id) && o.status !== 'Cancelled');
    return Object.assign(publicUser(u), {
      orderCount: orders.length,
      spend: orders.reduce((sum, o) => sum + o.total, 0)
    });
  });
  res.json({ users });
});

router.delete('/users/:id', (req, res) => {
  const store = db.load();
  const index = store.users.findIndex((u) => String(u._id) === String(req.params.id));
  if (index === -1) return res.status(404).json({ message: 'User not found.' });

  const user = store.users[index];
  if (String(user._id) === String(req.user._id)) {
    return res.status(400).json({ message: 'You cannot delete your own admin account.' });
  }
  if (user.role === 'admin') {
    return res.status(400).json({ message: 'Admin accounts cannot be deleted from this dashboard.' });
  }

  store.users.splice(index, 1);
  db.save();
  return res.json({ message: `${user.name}'s account was deleted.` });
});

module.exports = router;
