# FoodExpress — Online Food Ordering System

A full-stack online food ordering web app built from the FoodExpress project report
(BCA Full Stack Technologies — Group Assignment, Topic 4).

Customers browse restaurants, search and filter by cuisine or city, build a persistent cart,
place an order with GST included, pay by cash/card/UPI and track the delivery through its
five-stage lifecycle. Administrators get a dashboard for revenue statistics, restaurant and
menu CRUD, order status management and customer management.

## Feature checklist (from the report)

| Module | Implemented |
| --- | --- |
| Restaurant browsing | Search by name, cuisine, city or area; cuisine chips; city filter; sort by rating, delivery time or price; rating, delivery time and "closed" states |
| Menu & cart | Category-grouped menus, veg/non-veg markers, bestseller badges, quantity steppers, persistent cart in `localStorage`, single-restaurant cart guard |
| Order placement | Address and phone capture with validation, Cash on Delivery / Card / UPI, automatic 5% GST, ₹29 delivery fee (free over ₹499) |
| Order tracking | Live timeline Placed → Confirmed → Preparing → Out for Delivery → Delivered, auto-refresh every 15s, cancellation while Placed/Confirmed/Preparing |
| User management | Registration, JWT login, profile with saved address, customer/admin roles, route guards |
| Admin dashboard | Revenue/order statistics, restaurant CRUD, menu item CRUD, order status management, customer listing and deletion |

Demo accounts from the report are seeded:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@foodapp.com` | `admin123` |
| Customer | `ravi@example.com` | `ravi123` |
| Customer | `priya@example.com` | `priya123` |

## Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | AngularJS 1.8.3 SPA with `ngRoute` (vendored locally, no CDN needed), custom responsive CSS |
| Backend | Node.js + Express 4 REST API |
| Auth | JSON Web Tokens (`jsonwebtoken`) + `bcryptjs` password hashing |
| Data store | Document store persisted to `data/db.json` (see note below) |

**Data store note.** The report specifies MongoDB via Mongoose. That requires a running
database, which would stop the app from running out of the box in a demo environment, so this
build keeps the same document shapes (`users`, `restaurants`, `items`, `orders`) in a
file-backed store (`server/db.js`) with the demo seed from the report. The API is a plain REST
layer, so swapping in Mongoose later only means replacing the four small collections in
`server/db.js` with models — the route handlers already speak in documents.

## Getting started

```bash
npm install
cp .env.example .env      # optional, sensible defaults are built in
npm start                 # http://localhost:5000
```

For auto-restart during development:

```bash
npm run dev
```

Recreate the demo data at any time:

```bash
npm run seed
```

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `5000` | HTTP port |
| `JWT_SECRET` | dev fallback | Token signing secret — **change in production** |
| `JWT_EXPIRES_IN` | `7d` | Session lifetime |
| `GST_PERCENT` | `5` | Tax applied to orders |
| `DELIVERY_FEE` | `29` | Flat delivery fee |
| `FREE_DELIVERY_ABOVE` | `499` | Subtotal for free delivery |

## Project structure

```
server/
  index.js              Express app, static hosting, SPA fallback, error handler
  db.js                 Persistent document store + seed bootstrap
  seed-data.js          Restaurants, menus, demo users and orders
  seed.js               `npm run seed`
  middleware/auth.js    JWT signing, requireAuth, adminOnly, publicUser
  routes/               auth, restaurants, orders, admin
public/
  index.html            App shell: top bar, toasts, confirm dialog
  css/styles.css        Design system + responsive layout
  js/app.js             Module config, routes, guards, filters
  js/services.js        Auth, Cart, Totals, Toast, Confirm, OrderStatus
  js/shop.js            Home, restaurant, checkout, orders, profile, auth controllers
  js/admin.js           Admin dashboard controller
  views/*.html          Route templates
  img/restaurants/      Bundled cuisine photos for the restaurant covers
  vendor/               AngularJS 1.8.3 + ngRoute (offline copies)
scripts/api-test.js     End-to-end API smoke test
```

## REST API

Base URL: `/api`

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/auth/register` | — | Create an account |
| POST | `/auth/login` | — | Login and receive a JWT |
| GET | `/auth/me` | JWT | Current user details |
| PUT | `/auth/profile` | JWT | Update name, phone, saved address |
| GET | `/restaurants` | — | List restaurants (`?search=&cuisine=&city=`) |
| GET | `/restaurants/cuisines` | — | Distinct cuisines |
| GET | `/restaurants/cities` | — | Distinct cities |
| GET | `/restaurants/:id` | — | Restaurant with its grouped menu |
| POST | `/orders` | JWT | Place an order (server recalculates prices and GST) |
| GET | `/orders` | JWT | Current user's orders |
| GET | `/orders/:id` | JWT | Single order |
| PUT | `/orders/:id/cancel` | JWT | Cancel while Placed / Confirmed / Preparing |
| GET | `/admin/stats` | JWT + admin | Revenue, order and customer statistics |
| CRUD | `/admin/restaurants` | JWT + admin | Manage restaurants (deleting one also removes its menu) |
| CRUD | `/admin/items` | JWT + admin | Manage menu items |
| GET | `/admin/orders` | JWT + admin | All orders (filter with `?status=`) |
| PUT | `/admin/orders/:id/status` | JWT + admin | Update an order's status |
| GET | `/admin/users` | JWT + admin | List users with order count and spend |
| DELETE | `/admin/users/:id` | JWT + admin | Delete a customer account |

All errors return `{ "message": "..." }` with the appropriate 4xx/5xx status, and the UI shows
that message inline or as a toast.

## Verification

```bash
npm run test:api
```

The smoke test starts from the running server and checks authentication, restaurant search,
cart validation, server-side pricing, order placement, cancellation rules, admin authorisation
(403 for customers), statistics and restaurant/menu CRUD.

## Restaurant photos

The seeded restaurants use real cuisine photos bundled in `public/img/restaurants/`
(butter chicken, masala dosa, hakka noodles, margherita pizza, Hyderabadi biryani,
quinoa salad, cheeseburger and chocolate cake), downloaded from Wikimedia Commons.
Authors and licences are listed in [docs/image-credits.md](docs/image-credits.md);
`npm run images` re-downloads them. Restaurants without a photo, or with a broken
image URL, fall back to the coloured cover illustration. Administrators can set a
photo URL per restaurant in the admin dashboard.

## Security notes

- Passwords are hashed with bcrypt (10 rounds) and never returned by the API.
- Tokens are sent as `Authorization: Bearer …`; a 401 clears the stored session.
- Admin routes are protected by middleware on the server, not just hidden in the UI.
- Order totals, item prices and stock/closed states are always re-validated server-side.
- Change `JWT_SECRET` before deploying anywhere public.
