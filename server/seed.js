'use strict';

require('dotenv').config();
const db = require('./db');

const store = db.reset();

console.log('FoodExpress database seeded.');
console.log(`  Restaurants : ${store.restaurants.length}`);
console.log(`  Menu items  : ${store.items.length}`);
console.log(`  Orders      : ${store.orders.length}`);
console.log('');
console.log('Demo accounts');
console.log('  Admin    admin@foodapp.com / admin123');
console.log('  Customer ravi@example.com  / ravi123');
console.log('  Customer priya@example.com / priya123');
