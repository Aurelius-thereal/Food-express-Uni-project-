'use strict';

const bcrypt = require('bcryptjs');

const GST_PERCENT = 5;
const DELIVERY_FEE = 29;
const FREE_DELIVERY_ABOVE = 499;

const CATEGORY_ORDER = [
  'Bestsellers',
  'Starters',
  'Breakfast',
  'Burgers',
  'Pizza',
  'Pasta',
  'Biryani',
  'Bowls',
  'Salads',
  'Noodles',
  'Rice',
  'Main Course',
  'Breads',
  'Sides',
  'Combos',
  'Snacks',
  'Cakes',
  'Sweets',
  'Ice Cream',
  'Desserts',
  'Smoothies',
  'Beverages'
];

function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function daysAgo(days, hours = 0) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000 - hours * 60 * 60 * 1000).toISOString();
}

/**
 * Restaurant definitions. `theme` maps to a gradient class in the stylesheet and
 * `emoji` is used as a reliable, zero-network cover illustration.
 */
const restaurants = [
  {
    _id: 1,
    name: 'Spice Route',
    cuisine: 'North Indian',
    city: 'Mumbai',
    area: 'Bandra West',
    rating: 4.5,
    reviews: 1284,
    deliveryTime: '30-40 min',
    priceForTwo: 450,
    emoji: '🍛',
    theme: 'sunset',
    isOpen: true,
    description: 'Slow-cooked curries, tandoori kebabs and buttery naans from the kitchens of Punjab.',
    tags: ['Tandoor', 'Curries', 'Family friendly'],
    image: '/img/restaurants/spice-route.jpg'
  },
  {
    _id: 2,
    name: 'Dosa Junction',
    cuisine: 'South Indian',
    city: 'Bengaluru',
    area: 'Indiranagar',
    rating: 4.6,
    reviews: 2140,
    deliveryTime: '25-35 min',
    priceForTwo: 300,
    emoji: '🥘',
    theme: 'amber',
    isOpen: true,
    description: 'Crisp dosas, fluffy idlis and filter coffee brewed the old-fashioned way.',
    tags: ['Pure veg', 'Breakfast', 'Budget'],
    image: '/img/restaurants/dosa-junction.jpg'
  },
  {
    _id: 3,
    name: 'Wok & Roll',
    cuisine: 'Chinese',
    city: 'Mumbai',
    area: 'Andheri East',
    rating: 4.2,
    reviews: 876,
    deliveryTime: '35-45 min',
    priceForTwo: 500,
    emoji: '🍜',
    theme: 'jade',
    isOpen: true,
    description: 'Wok-tossed noodles, smoky fried rice and Indo-Chinese classics with real heat.',
    tags: ['Wok tossed', 'Spicy', 'Late night'],
    image: '/img/restaurants/wok-and-roll.jpg'
  },
  {
    _id: 4,
    name: 'Bella Napoli',
    cuisine: 'Italian',
    city: 'Pune',
    area: 'Koregaon Park',
    rating: 4.7,
    reviews: 1520,
    deliveryTime: '40-50 min',
    priceForTwo: 700,
    emoji: '🍕',
    theme: 'tomato',
    isOpen: true,
    description: 'Wood-fired Neapolitan pizzas, handmade pasta and a proper tiramisu.',
    tags: ['Wood fired', 'Pasta', 'Desserts'],
    image: '/img/restaurants/bella-napoli.jpg'
  },
  {
    _id: 5,
    name: 'Biryani Bazaar',
    cuisine: 'Biryani',
    city: 'Hyderabad',
    area: 'Banjara Hills',
    rating: 4.4,
    reviews: 3120,
    deliveryTime: '30-45 min',
    priceForTwo: 400,
    emoji: '🍚',
    theme: 'saffron',
    isOpen: true,
    description: 'Dum-cooked Hyderabadi biryani sealed with dough and served with mirchi ka salan.',
    tags: ['Dum biryani', 'Kebabs', 'Bestseller'],
    image: '/img/restaurants/biryani-bazaar.jpg'
  },
  {
    _id: 6,
    name: 'Green Bowl',
    cuisine: 'Healthy',
    city: 'Bengaluru',
    area: 'Koramangala',
    rating: 4.3,
    reviews: 640,
    deliveryTime: '20-30 min',
    priceForTwo: 350,
    emoji: '🥗',
    theme: 'leaf',
    isOpen: false,
    description: 'Protein-packed grain bowls, fresh salads and cold-pressed smoothies.',
    tags: ['High protein', 'Salads', 'Smoothies'],
    image: '/img/restaurants/green-bowl.jpg'
  },
  {
    _id: 7,
    name: 'Burger Barn',
    cuisine: 'Fast Food',
    city: 'Pune',
    area: 'Viman Nagar',
    rating: 4.1,
    reviews: 1890,
    deliveryTime: '20-30 min',
    priceForTwo: 300,
    emoji: '🍔',
    theme: 'caramel',
    isOpen: true,
    description: 'Smashed patties, crinkle-cut fries and thick shakes — comfort food, fast.',
    tags: ['Burgers', 'Combos', 'Quick'],
    image: '/img/restaurants/burger-barn.jpg'
  },
  {
    _id: 8,
    name: 'Sweet Tooth',
    cuisine: 'Desserts',
    city: 'Mumbai',
    area: 'Juhu',
    rating: 4.8,
    reviews: 980,
    deliveryTime: '15-25 min',
    priceForTwo: 250,
    emoji: '🍰',
    theme: 'berry',
    isOpen: true,
    description: 'Freshly baked cakes, pastries and Indian sweets delivered chilled.',
    tags: ['Bakery', 'Cakes', 'Gifting'],
    image: '/img/restaurants/sweet-tooth.jpg'
  }
];

/** [category, name, price, isVeg, description, bestseller] */
const menus = {
  1: [
    ['Starters', 'Paneer Tikka', 249, true, 'Char-grilled cottage cheese cubes with mint chutney', true],
    ['Starters', 'Chicken Seekh Kebab', 289, false, 'Minced chicken skewers finished in the tandoor', false],
    ['Starters', 'Tandoori Mushroom', 239, true, 'Button mushrooms marinated in yoghurt and spices', false],
    ['Main Course', 'Butter Chicken', 329, false, 'Tandoori chicken simmered in a silky tomato gravy', true],
    ['Main Course', 'Paneer Butter Masala', 279, true, 'Cottage cheese in a creamy cashew-tomato gravy', false],
    ['Main Course', 'Dal Makhani', 219, true, 'Black lentils slow cooked overnight with butter', false],
    ['Main Course', 'Kadhai Chicken', 319, false, 'Chicken tossed with peppers and fresh coriander', false],
    ['Breads', 'Butter Naan', 49, true, 'Soft tandoor naan brushed with butter', false],
    ['Breads', 'Laccha Paratha', 59, true, 'Flaky layered whole wheat paratha', false],
    ['Breads', 'Tandoori Roti', 29, true, 'Whole wheat roti straight off the tandoor', false],
    ['Rice', 'Jeera Rice', 149, true, 'Basmati rice tempered with cumin', false],
    ['Rice', 'Veg Pulao', 169, true, 'Fragrant rice with seasonal vegetables', false],
    ['Desserts', 'Gulab Jamun', 99, true, 'Two warm jamuns soaked in cardamom syrup', false],
    ['Beverages', 'Masala Chaas', 79, true, 'Spiced buttermilk with roasted cumin', false]
  ],
  2: [
    ['Breakfast', 'Masala Dosa', 129, true, 'Crisp dosa filled with spiced potato masala', true],
    ['Breakfast', 'Plain Dosa', 99, true, 'Golden dosa served with sambar and three chutneys', false],
    ['Breakfast', 'Rava Onion Dosa', 139, true, 'Semolina dosa studded with onions and curry leaves', false],
    ['Breakfast', 'Idli Vada Combo', 89, true, 'Two idlis and one medu vada with sambar', true],
    ['Lunch', 'South Indian Thali', 249, true, 'Rice, sambar, rasam, poriyal, curd and payasam', false],
    ['Lunch', 'Bisi Bele Bath', 149, true, 'Karnataka-style rice and lentil one-pot meal', false],
    ['Lunch', 'Curd Rice', 109, true, 'Comforting curd rice with pomegranate and tempering', false],
    ['Snacks', 'Medu Vada', 69, true, 'Crisp lentil doughnuts with coconut chutney', false],
    ['Snacks', 'Mysore Bonda', 79, true, 'Fluffy fried dumplings with green chutney', false],
    ['Beverages', 'Filter Coffee', 49, true, 'Strong decoction with frothy hot milk', true],
    ['Beverages', 'Badam Milk', 69, true, 'Chilled almond milk with saffron', false]
  ],
  3: [
    ['Starters', 'Veg Spring Rolls', 179, true, 'Crisp rolls stuffed with cabbage and carrots', false],
    ['Starters', 'Chilli Chicken', 249, false, 'Crispy chicken tossed with peppers and chilli sauce', true],
    ['Starters', 'Crispy Corn', 169, true, 'Sweet corn kernels fried and tossed in pepper salt', false],
    ['Noodles', 'Veg Hakka Noodles', 199, true, 'Classic wok-tossed noodles with vegetables', false],
    ['Noodles', 'Chicken Schezwan Noodles', 239, false, 'Noodles in a fiery house-made schezwan sauce', true],
    ['Rice', 'Egg Fried Rice', 209, false, 'Fried rice with scrambled egg and spring onion', false],
    ['Rice', 'Veg Schezwan Fried Rice', 199, true, 'Spicy fried rice with crunchy vegetables', false],
    ['Main Course', 'Paneer Chilli Gravy', 259, true, 'Paneer in a glossy chilli-garlic gravy', false],
    ['Main Course', 'Kung Pao Chicken', 289, false, 'Chicken with peanuts, dried chilli and scallions', false],
    ['Beverages', 'Iced Lemon Tea', 89, true, 'Freshly brewed tea with lemon and ice', false]
  ],
  4: [
    ['Starters', 'Garlic Bread with Cheese', 199, true, 'Toasted baguette with garlic butter and mozzarella', true],
    ['Starters', 'Bruschetta Pomodoro', 219, true, 'Grilled bread topped with tomato, basil and olive oil', false],
    ['Pizza', 'Margherita', 349, true, 'San Marzano tomato, fior di latte and basil', true],
    ['Pizza', 'Farmhouse Pizza', 449, true, 'Peppers, onion, corn, olives and mushroom', false],
    ['Pizza', 'Pepperoni Pizza', 499, false, 'Spicy pepperoni with mozzarella and oregano', false],
    ['Pasta', 'Penne Alfredo', 379, true, 'Penne in a garlicky parmesan cream sauce', false],
    ['Pasta', 'Spaghetti Aglio e Olio', 329, true, 'Garlic, chilli flakes and extra virgin olive oil', false],
    ['Pasta', 'Chicken Arrabbiata', 429, false, 'Spaghetti with chicken in a spicy tomato sauce', false],
    ['Desserts', 'Tiramisu', 279, true, 'Mascarpone, espresso and cocoa — made in house', true],
    ['Desserts', 'Chocolate Lava Cake', 249, true, 'Warm cake with a molten chocolate centre', false],
    ['Beverages', 'Fresh Lime Soda', 129, true, 'Sweet, salted or mixed — your call', false]
  ],
  5: [
    ['Biryani', 'Hyderabadi Chicken Dum Biryani', 329, false, 'Long grain basmati layered with chicken and saffron', true],
    ['Biryani', 'Mutton Biryani', 399, false, 'Slow dum-cooked mutton with whole spices', false],
    ['Biryani', 'Veg Dum Biryani', 259, true, 'Vegetables and basmati sealed and dum cooked', false],
    ['Biryani', 'Egg Biryani', 279, false, 'Spiced rice with boiled eggs and fried onions', false],
    ['Starters', 'Chicken 65', 269, false, 'Crispy fried chicken with curry leaf and yoghurt', true],
    ['Starters', 'Mirchi Ka Salan', 129, true, 'Peanut and sesame gravy with green chillies', false],
    ['Sides', 'Raita', 49, true, 'Cooling onion and cucumber yoghurt', false],
    ['Sweets', 'Double Ka Meetha', 119, true, 'Fried bread pudding in saffron milk', false],
    ['Beverages', 'Sweet Lassi', 89, true, 'Thick curd lassi topped with malai', false]
  ],
  6: [
    ['Bowls', 'Quinoa Power Bowl', 319, true, 'Quinoa, chickpeas, roasted veg and tahini dressing', true],
    ['Bowls', 'Grilled Chicken Bowl', 349, false, 'Grilled chicken, brown rice and greens', false],
    ['Bowls', 'Paneer Tikka Bowl', 299, true, 'Tandoori paneer, millet and mint yoghurt', false],
    ['Salads', 'Caesar Salad', 279, true, 'Cos lettuce, croutons and creamy dressing', false],
    ['Salads', 'Mediterranean Salad', 259, true, 'Olives, feta, cucumber and cherry tomato', false],
    ['Smoothies', 'Berry Blast Smoothie', 199, true, 'Mixed berries, banana and curd', true],
    ['Smoothies', 'Mango Protein Shake', 219, true, 'Alphonso mango with whey protein', false],
    ['Snacks', 'Hummus & Pita', 179, true, 'House hummus with warm whole wheat pita', false]
  ],
  7: [
    ['Burgers', 'Classic Veg Burger', 129, true, 'Crunchy veg patty, lettuce and house sauce', false],
    ['Burgers', 'Crispy Chicken Burger', 179, false, 'Buttermilk-fried chicken with pickles', true],
    ['Burgers', 'Paneer Zinger Burger', 189, true, 'Spicy paneer patty with cheese and slaw', false],
    ['Sides', 'Peri Peri Fries', 119, true, 'Crinkle-cut fries with peri peri seasoning', true],
    ['Sides', 'Cheesy Nachos', 179, true, 'Corn chips with cheese sauce and jalapenos', false],
    ['Sides', 'Onion Rings', 129, true, 'Battered onion rings with dip', false],
    ['Combos', 'Burger + Fries Combo', 249, true, 'Any veg burger with peri peri fries and a cola', false],
    ['Combos', 'Chicken Meal Box', 329, false, 'Chicken burger, fries, dip and a cola', false],
    ['Beverages', 'Chocolate Thick Shake', 169, true, 'Chocolate ice cream blended thick', false],
    ['Beverages', 'Cold Coffee', 149, true, 'Classic cold coffee with ice cream', false]
  ],
  8: [
    ['Cakes', 'Belgian Chocolate Slice', 219, true, 'Dark chocolate ganache on a moist sponge', true],
    ['Cakes', 'Red Velvet Pastry', 199, true, 'Cream cheese frosting, cocoa sponge', false],
    ['Sweets', 'Rasmalai (2 pcs)', 149, true, 'Chenna discs in saffron-infused milk', false],
    ['Sweets', 'Gajar Halwa', 169, true, 'Grated carrot pudding with ghee and nuts', false],
    ['Ice Cream', 'Vanilla Bean Tub', 249, true, '500 ml of real Madagascar vanilla', false],
    ['Ice Cream', 'Brownie Sundae', 229, true, 'Warm brownie, vanilla scoop, chocolate sauce', true],
    ['Beverages', 'Hot Chocolate', 159, true, 'Belgian cocoa with steamed milk', false]
  ]
};

function buildItems() {
  const items = [];
  let id = 0;
  restaurants.forEach((restaurant) => {
    (menus[restaurant._id] || []).forEach((row) => {
      id += 1;
      items.push({
        _id: id,
        restaurantId: restaurant._id,
        category: row[0],
        name: row[1],
        price: row[2],
        isVeg: row[3],
        description: row[4],
        isBestseller: row[5],
        isAvailable: true
      });
    });
  });
  return items;
}

const items = buildItems();

function makeOrder({ id, userId, restaurantId, lines, address, phone, paymentMethod, status, createdAt }) {
  const restaurant = restaurants.find((r) => r._id === restaurantId);
  const orderItems = lines.map(([itemId, qty]) => {
    const item = items.find((i) => i._id === itemId);
    return {
      itemId: item._id,
      name: item.name,
      price: item.price,
      qty,
      isVeg: item.isVeg,
      lineTotal: item.price * qty
    };
  });

  const subtotal = orderItems.reduce((sum, i) => sum + i.lineTotal, 0);
  const gst = Math.round((subtotal * GST_PERCENT) / 100);
  const deliveryFee = subtotal >= FREE_DELIVERY_ABOVE ? 0 : DELIVERY_FEE;

  const flow = ['Placed', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered'];
  const history = [];
  if (status === 'Cancelled') {
    history.push({ status: 'Placed', at: createdAt });
    history.push({ status: 'Cancelled', at: minutesAgo(5) });
  } else {
    const lastIndex = flow.indexOf(status);
    for (let i = 0; i <= lastIndex; i += 1) {
      const at = new Date(new Date(createdAt).getTime() + i * 12 * 60 * 1000).toISOString();
      history.push({ status: flow[i], at });
    }
  }

  return {
    _id: id,
    orderNumber: `FE-${id}`,
    userId,
    restaurantId,
    restaurantName: restaurant.name,
    restaurantEmoji: restaurant.emoji,
    restaurantTheme: restaurant.theme,
    items: orderItems,
    address,
    phone,
    paymentMethod,
    subtotal,
    gst,
    deliveryFee,
    total: subtotal + gst + deliveryFee,
    status,
    statusHistory: history,
    createdAt,
    updatedAt: createdAt
  };
}

function buildSeed() {
  const users = [
    {
      _id: 1,
      name: 'Admin',
      email: 'admin@foodapp.com',
      passwordHash: bcrypt.hashSync('admin123', 10),
      phone: '9000000001',
      address: 'FoodExpress HQ, Fort, Mumbai',
      role: 'admin',
      createdAt: daysAgo(90)
    },
    {
      _id: 2,
      name: 'Ravi Kumar',
      email: 'ravi@example.com',
      passwordHash: bcrypt.hashSync('ravi123', 10),
      phone: '9876543210',
      address: '12B, Rose Villa, Hill Road, Bandra West, Mumbai',
      role: 'customer',
      createdAt: daysAgo(30)
    },
    {
      _id: 3,
      name: 'Priya Sharma',
      email: 'priya@example.com',
      passwordHash: bcrypt.hashSync('priya123', 10),
      phone: '9820011223',
      address: 'Flat 501, Lake View, Kalyani Nagar, Pune',
      role: 'customer',
      createdAt: daysAgo(21)
    }
  ];

  const orders = [
    makeOrder({
      id: 1001,
      userId: 2,
      restaurantId: 1,
      lines: [[4, 1], [8, 2]],
      address: '12B, Rose Villa, Hill Road, Bandra West, Mumbai',
      phone: '9876543210',
      paymentMethod: 'UPI',
      status: 'Delivered',
      createdAt: daysAgo(3, 2)
    }),
    makeOrder({
      id: 1002,
      userId: 2,
      restaurantId: 2,
      lines: [[15, 2], [24, 2]],
      address: '12B, Rose Villa, Hill Road, Bandra West, Mumbai',
      phone: '9876543210',
      paymentMethod: 'Cash on Delivery',
      status: 'Out for Delivery',
      createdAt: minutesAgo(48)
    }),
    makeOrder({
      id: 1003,
      userId: 2,
      restaurantId: 5,
      lines: [[39, 1], [44, 1]],
      address: '12B, Rose Villa, Hill Road, Bandra West, Mumbai',
      phone: '9876543210',
      paymentMethod: 'Cash on Delivery',
      status: 'Placed',
      createdAt: minutesAgo(9)
    }),
    makeOrder({
      id: 1004,
      userId: 3,
      restaurantId: 4,
      lines: [[29, 1], [25, 1]],
      address: 'Flat 501, Lake View, Kalyani Nagar, Pune',
      phone: '9820011223',
      paymentMethod: 'Card',
      status: 'Delivered',
      createdAt: daysAgo(1, 3)
    }),
    makeOrder({
      id: 1005,
      userId: 3,
      restaurantId: 7,
      lines: [[58, 1], [61, 1]],
      address: 'Flat 501, Lake View, Kalyani Nagar, Pune',
      phone: '9820011223',
      paymentMethod: 'Cash on Delivery',
      status: 'Cancelled',
      createdAt: daysAgo(2, 5)
    })
  ];

  return {
    counters: { user: 3, restaurant: 8, item: items.length, order: 1005 },
    users,
    restaurants: restaurants.map((r) => Object.assign({}, r)),
    items: items.map((i) => Object.assign({}, i)),
    orders
  };
}

module.exports = buildSeed;
module.exports.CATEGORY_ORDER = CATEGORY_ORDER;
