'use strict';

const express = require('express');
const db = require('../db');
const { CATEGORY_ORDER } = require('../seed-data');

const router = express.Router();

function itemSort(a, b) {
  const ai = CATEGORY_ORDER.indexOf(a.category);
  const bi = CATEGORY_ORDER.indexOf(b.category);
  const ac = ai === -1 ? CATEGORY_ORDER.length : ai;
  const bc = bi === -1 ? CATEGORY_ORDER.length : bi;
  if (ac !== bc) return ac - bc;
  return a.name.localeCompare(b.name);
}

function matches(restaurant, { search, cuisine, city }) {
  if (cuisine && restaurant.cuisine.toLowerCase() !== String(cuisine).toLowerCase()) return false;
  if (city && restaurant.city.toLowerCase() !== String(city).toLowerCase()) return false;
  if (search) {
    const q = String(search).toLowerCase();
    const haystack = [restaurant.name, restaurant.cuisine, restaurant.city, restaurant.area]
      .concat(restaurant.tags || [])
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

router.get('/', (req, res) => {
  const store = db.load();
  const filters = {
    search: String(req.query.search || '').trim(),
    cuisine: String(req.query.cuisine || '').trim(),
    city: String(req.query.city || '').trim()
  };

  const results = store.restaurants
    .filter((r) => matches(r, filters))
    .map((r) => {
      const count = store.items.filter((i) => i.restaurantId === r._id).length;
      return Object.assign({}, r, { itemCount: count });
    });

  res.json({ restaurants: results, filters });
});

router.get('/cuisines', (req, res) => {
  const store = db.load();
  const cuisines = Array.from(new Set(store.restaurants.map((r) => r.cuisine))).sort();
  res.json({ cuisines });
});

router.get('/cities', (req, res) => {
  const store = db.load();
  const cities = Array.from(new Set(store.restaurants.map((r) => r.city))).sort();
  res.json({ cities });
});

router.get('/:id', (req, res) => {
  const store = db.load();
  const restaurant = store.restaurants.find((r) => String(r._id) === String(req.params.id));

  if (!restaurant) {
    return res.status(404).json({ message: 'We could not find that restaurant.' });
  }

  const items = store.items
    .filter((i) => i.restaurantId === restaurant._id)
    .sort(itemSort);

  const categories = [];
  items.forEach((item) => {
    if (!categories.includes(item.category)) categories.push(item.category);
  });

  return res.json({ restaurant, items, categories });
});

module.exports = router;
