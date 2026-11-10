'use strict';

/**
 * End-to-end API smoke test.
 * Usage: npm start (in another shell) then `npm run test:api`
 * Override the target with BASE_URL=http://localhost:3000/api
 */

const BASE = process.env.BASE_URL || 'http://localhost:5000/api';

let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`);
  }
}

async function call(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  let data = null;
  try {
    data = await res.json();
  } catch (err) {
    data = null;
  }
  return { status: res.status, data };
}

async function main() {
  const stamp = Date.now();
  const email = `tester.${stamp}@example.com`;
  let customerToken = null;
  let adminToken = null;
  let restaurantId = null;
  let itemId = null;
  let orderId = null;

  console.log(`FoodExpress API smoke test → ${BASE}`);

  console.log('\nPublic catalogue');
  const list = await call('GET', '/restaurants');
  check('GET /restaurants returns a list', list.status === 200 && Array.isArray(list.data.restaurants));
  check('seed contains restaurants', list.data && list.data.restaurants.length >= 8);
  const cuisines = await call('GET', '/restaurants/cuisines');
  check('GET /restaurants/cuisines works', cuisines.status === 200 && cuisines.data.cuisines.length > 0);
  const filtered = await call('GET', '/restaurants?cuisine=Italian');
  check('cuisine filter narrows results',
    filtered.data.restaurants.length > 0 &&
    filtered.data.restaurants.every((r) => r.cuisine === 'Italian'));
  const search = await call('GET', '/restaurants?search=biryani');
  check('search matches name/cuisine', search.data.restaurants.length > 0);
  const city = await call('GET', '/restaurants?city=Pune');
  check('city filter works', city.data.restaurants.every((r) => r.city === 'Pune'));

  const first = list.data.restaurants.find((r) => r.isOpen);
  const menu = await call('GET', '/restaurants/' + first._id);
  check('GET /restaurants/:id returns menu', menu.status === 200 && menu.data.items.length > 0);
  check('menu exposes categories', menu.data.categories.length > 0);
  const missing = await call('GET', '/restaurants/99999');
  check('unknown restaurant returns 404', missing.status === 404);

  console.log('\nAuthentication');
  const badLogin = await call('POST', '/auth/login', { email: 'admin@foodapp.com', password: 'wrong' });
  check('wrong password rejected', badLogin.status === 401 && /incorrect/i.test(badLogin.data.message));

  const shortPassword = await call('POST', '/auth/register', { name: 'Test', email, password: '123' });
  check('short password rejected', shortPassword.status === 400);

  const register = await call('POST', '/auth/register', {
    name: 'Test Customer', email, password: 'test1234', phone: '9876500000'
  });
  check('registration returns a token', register.status === 201 && !!register.data.token);
  check('registration hides the password hash',
    register.data.user && register.data.user.passwordHash === undefined);
  customerToken = register.data.token;

  const duplicate = await call('POST', '/auth/register', { name: 'Dup', email, password: 'test1234' });
  check('duplicate email rejected', duplicate.status === 409);

  const me = await call('GET', '/auth/me', undefined, customerToken);
  check('GET /auth/me works with JWT', me.status === 200 && me.data.user.email === email);

  const noToken = await call('GET', '/orders');
  check('protected route rejects anonymous calls', noToken.status === 401);

  const profile = await call('PUT', '/auth/profile', {
    name: 'Test Customer', phone: '9876500001', address: '88 Test Street, Andheri West, Mumbai'
  }, customerToken);
  check('profile update saves the address', profile.status === 200 && profile.data.user.phone === '9876500001');

  console.log('\nCart and orders');
  const emptyOrder = await call('POST', '/orders', {
    items: [], address: '88 Test Street, Andheri West, Mumbai', phone: '9876500001', paymentMethod: 'UPI'
  }, customerToken);
  check('empty cart rejected', emptyOrder.status === 400);

  const item = menu.data.items.find((i) => i.isAvailable);
  const noAddress = await call('POST', '/orders', {
    items: [{ itemId: item._id, qty: 2 }], address: '', phone: '9876500001', paymentMethod: 'UPI'
  }, customerToken);
  check('missing address rejected', noAddress.status === 400);

  const badPhone = await call('POST', '/orders', {
    items: [{ itemId: item._id, qty: 1 }], address: '88 Test Street, Andheri West, Mumbai',
    phone: 'abc', paymentMethod: 'UPI'
  }, customerToken);
  check('invalid phone rejected', badPhone.status === 400);

  const badPayment = await call('POST', '/orders', {
    items: [{ itemId: item._id, qty: 1 }], address: '88 Test Street, Andheri West, Mumbai',
    phone: '9876500001', paymentMethod: 'Crypto'
  }, customerToken);
  check('invalid payment method rejected', badPayment.status === 400);

  const placed = await call('POST', '/orders', {
    items: [{ itemId: item._id, qty: 2 }],
    address: '88 Test Street, Andheri West, Mumbai',
    phone: '9876500001',
    paymentMethod: 'Cash on Delivery'
  }, customerToken);
  check('order placed', placed.status === 201 && placed.data.order.status === 'Placed');
  const order = placed.data.order;
  orderId = order._id;
  check('subtotal computed server-side', order.subtotal === item.price * 2,
    `expected ${item.price * 2}, got ${order.subtotal}`);
  check('GST is 5%', order.gst === Math.round(order.subtotal * 0.05));
  check('total = subtotal + gst + delivery', order.total === order.subtotal + order.gst + order.deliveryFee);
  check('status history starts with Placed', order.statusHistory[0].status === 'Placed');

  const myOrders = await call('GET', '/orders', undefined, customerToken);
  check('order appears in My Orders', myOrders.status === 200 && myOrders.data.orders.some((o) => o._id === orderId));

  const otherCustomer = await call('POST', '/auth/login', { email: 'priya@example.com', password: 'priya123' });
  const foreign = await call('GET', '/orders/' + orderId, undefined, otherCustomer.data.token);
  check('another customer cannot read the order', foreign.status === 403);

  const adminDenied = await call('GET', '/admin/stats', undefined, customerToken);
  check('customer blocked from admin API', adminDenied.status === 403);

  const admin = await call('POST', '/auth/login', { email: 'admin@foodapp.com', password: 'admin123' });
  check('admin login works', admin.status === 200 && admin.data.user.role === 'admin');
  adminToken = admin.data.token;

  const stats = await call('GET', '/admin/stats', undefined, adminToken);
  check('admin stats available', stats.status === 200 && typeof stats.data.stats.revenue === 'number');

  const confirmOrder = await call('PUT', '/admin/orders/' + orderId + '/status', { status: 'Confirmed' }, adminToken);
  check('admin advances order status', confirmOrder.status === 200 && confirmOrder.data.order.status === 'Confirmed');

  const cancel = await call('PUT', '/orders/' + orderId + '/cancel', {}, customerToken);
  check('customer can cancel a confirmed order', cancel.status === 200 && cancel.data.order.status === 'Cancelled');

  const cancelAgain = await call('PUT', '/orders/' + orderId + '/cancel', {}, customerToken);
  check('cancelled order cannot be cancelled twice', cancelAgain.status === 400);

  const statusAfterCancel = await call('PUT', '/admin/orders/' + orderId + '/status', { status: 'Preparing' }, adminToken);
  check('cancelled order status is locked', statusAfterCancel.status === 400);

  console.log('\nAdmin CRUD');
  const newRestaurant = await call('POST', '/admin/restaurants', {
    name: 'Test Kitchen ' + stamp, cuisine: 'Test Cuisine', city: 'Mumbai', area: 'Test Area',
    deliveryTime: '20-25 min', priceForTwo: 300, rating: 4.2, emoji: '🍲', theme: 'jade',
    tags: ['Test'], isOpen: true
  }, adminToken);
  check('restaurant created', newRestaurant.status === 201);
  restaurantId = newRestaurant.data.restaurant._id;

  const missingName = await call('POST', '/admin/restaurants', { city: 'Mumbai' }, adminToken);
  check('restaurant validation works', missingName.status === 400);

  const updatedRestaurant = await call('PUT', '/admin/restaurants/' + restaurantId, {
    name: 'Test Kitchen Updated ' + stamp, isOpen: false
  }, adminToken);
  check('restaurant updated', updatedRestaurant.status === 200 && updatedRestaurant.data.restaurant.isOpen === false);

  const newItem = await call('POST', '/admin/items', {
    restaurantId, name: 'Test Dish', price: 199, category: 'Starters', description: 'A test dish',
    isVeg: true, isBestseller: false, isAvailable: true
  }, adminToken);
  check('menu item created', newItem.status === 201);
  itemId = newItem.data.item._id;

  const closedOrder = await call('POST', '/orders', {
    items: [{ itemId, qty: 1 }], address: '88 Test Street, Andheri West, Mumbai',
    phone: '9876500001', paymentMethod: 'UPI'
  }, customerToken);
  check('closed restaurant cannot be ordered from', closedOrder.status === 400);

  const removedItem = await call('DELETE', '/admin/items/' + itemId, undefined, adminToken);
  check('menu item deleted', removedItem.status === 200);

  const users = await call('GET', '/admin/users', undefined, adminToken);
  check('user list available', users.status === 200 && users.data.users.length > 0);
  const cannotReadUsers = await call('GET', '/admin/users', undefined, customerToken);
  check('customer cannot list users', cannotReadUsers.status === 403);

  const removedRestaurant = await call('DELETE', '/admin/restaurants/' + restaurantId, undefined, adminToken);
  check('restaurant deleted', removedRestaurant.status === 200);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('\nSmoke test crashed:', err.message);
  console.error('Is the server running at ' + BASE + '?');
  process.exit(1);
});
