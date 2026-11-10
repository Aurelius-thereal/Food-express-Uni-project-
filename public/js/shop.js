(function () {
  'use strict';

  angular.module('foodExpress')

    /* ============================================================ HOME */
    .controller('HomeController', ['$http', '$timeout', 'API_BASE', 'Toast', 'errorText',
      function ($http, $timeout, API_BASE, Toast, errorText) {
        var vm = this;
        var debounce = null;

        vm.restaurants = [];
        vm.cuisines = [];
        vm.cities = [];
        vm.loading = true;
        vm.error = '';
        vm.filters = { search: '', cuisine: '', city: '', sort: 'recommended' };

        function load() {
          vm.loading = true;
          vm.error = '';
          $http.get(API_BASE + '/restaurants', {
            params: {
              search: vm.filters.search,
              cuisine: vm.filters.cuisine,
              city: vm.filters.city
            }
          }).then(function (res) {
            vm.restaurants = res.data.restaurants;
            vm.loading = false;
          }).catch(function (err) {
            vm.error = errorText(err);
            vm.loading = false;
          });
        }

        vm.search = function () {
          if (debounce) $timeout.cancel(debounce);
          debounce = $timeout(load, 300);
        };

        vm.searchNow = function () {
          if (debounce) $timeout.cancel(debounce);
          load();
        };

        vm.pickCuisine = function (cuisine) {
          vm.filters.cuisine = vm.filters.cuisine === cuisine ? '' : cuisine;
          load();
        };

        vm.clearFilters = function () {
          vm.filters = { search: '', cuisine: '', city: '', sort: 'recommended' };
          load();
        };

        vm.hasFilters = function () {
          return !!(vm.filters.search || vm.filters.cuisine || vm.filters.city);
        };

        vm.sorted = function () {
          var list = (vm.restaurants || []).slice();
          if (vm.filters.sort === 'rating') {
            list.sort(function (a, b) { return b.rating - a.rating; });
          } else if (vm.filters.sort === 'price-low') {
            list.sort(function (a, b) { return a.priceForTwo - b.priceForTwo; });
          } else if (vm.filters.sort === 'delivery') {
            list.sort(function (a, b) { return parseInt(a.deliveryTime, 10) - parseInt(b.deliveryTime, 10); });
          } else {
            list.sort(function (a, b) {
              if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;
              return b.rating - a.rating;
            });
          }
          return list;
        };

        $http.get(API_BASE + '/restaurants/cuisines').then(function (res) {
          vm.cuisines = res.data.cuisines;
        });
        $http.get(API_BASE + '/restaurants/cities').then(function (res) {
          vm.cities = res.data.cities;
        });

        load();
      }
    ])

    /* ====================================================== RESTAURANT */
    .controller('RestaurantController', ['$routeParams', '$http', '$window', 'API_BASE', 'Cart', 'Confirm', 'Toast', 'errorText',
      function ($routeParams, $http, $window, API_BASE, Cart, Confirm, Toast, errorText) {
        var vm = this;

        vm.loading = true;
        vm.error = '';
        vm.restaurant = null;
        vm.items = [];
        vm.categories = [];

        function load() {
          vm.loading = true;
          $http.get(API_BASE + '/restaurants/' + $routeParams.id).then(function (res) {
            vm.restaurant = res.data.restaurant;
            vm.items = res.data.items;
            vm.categories = res.data.categories;
            vm.loading = false;
            document.title = res.data.restaurant.name + ' · FoodExpress';
          }).catch(function (err) {
            vm.error = errorText(err);
            vm.loading = false;
          });
        }

        vm.qtyOf = function (itemId) { return Cart.qtyOf(itemId); };
        vm.cartCount = function () { return Cart.count(); };
        vm.cartItems = function () { return Cart.items(); };
        vm.subtotal = function () { return Cart.subtotal(); };
        vm.gst = function () { return Math.round(Cart.subtotal() * 0.05); };
        vm.deliveryFee = function () {
          var subtotal = Cart.subtotal();
          if (subtotal === 0 || subtotal >= 499) return 0;
          return 29;
        };
        vm.cartTotal = function () {
          return Cart.subtotal() + vm.gst() + vm.deliveryFee();
        };

        vm.add = function (item) {
          var cartRestaurant = Cart.restaurant();
          var added = Cart.add(item, vm.restaurant);

          if (added === false) {
            Confirm({
              title: 'Start a new cart?',
              message: 'Your cart already has items from ' + cartRestaurant.name +
                '. Adding dishes from ' + vm.restaurant.name + ' will clear the current cart.',
              confirmLabel: 'Clear & add',
              danger: true
            }).then(function (ok) {
              if (!ok) return;
              Cart.clear();
              Cart.add(item, vm.restaurant);
              Toast.success(item.name + ' added to your cart.');
            });
            return;
          }

          Toast.success(item.name + ' added to your cart.');
        };

        vm.increment = function (item) {
          Cart.increment(item._id);
        };

        vm.decrement = function (item) {
          Cart.decrement(item._id);
        };

        vm.itemsIn = function (category) {
          return vm.items.filter(function (item) { return item.category === category; });
        };

        vm.goToCategory = function (category) {
          var el = document.getElementById('cat-' + category.replace(/[^a-zA-Z0-9]+/g, '-'));
          if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };

        vm.categoryId = function (category) {
          return 'cat-' + category.replace(/[^a-zA-Z0-9]+/g, '-');
        };

        load();
      }
    ])

    /* ======================================================== CHECKOUT */
    .controller('CheckoutController', ['$http', '$location', 'API_BASE', 'Cart', 'Auth', 'Totals', 'Toast', 'Confirm', 'errorText',
      function ($http, $location, API_BASE, Cart, Auth, Totals, Toast, Confirm, errorText) {
        var vm = this;
        var user = Auth.user() || {};

        vm.items = Cart.items();
        vm.placing = false;
        vm.error = '';
        vm.savedAddress = user.address || '';
        vm.form = {
          address: user.address || '',
          phone: user.phone || '',
          paymentMethod: 'Cash on Delivery'
        };
        vm.payments = [
          { value: 'Cash on Delivery', label: 'Cash on Delivery', icon: '💵', desc: 'Pay when it arrives' },
          { value: 'Card', label: 'Card', icon: '💳', desc: 'Visa, Mastercard, RuPay' },
          { value: 'UPI', label: 'UPI', icon: '📱', desc: 'GPay, PhonePe, Paytm' }
        ];

        vm.subtotal = Cart.subtotal;
        vm.totals = function () { return Totals.calc(Cart.subtotal()); };
        vm.isEmpty = function () { return Cart.count() === 0; };
        vm.pickPayment = function (method) { vm.form.paymentMethod = method; };

        vm.changeQty = function (item, delta) {
          Cart.setQty(item.itemId, item.qty + delta);
        };
        vm.remove = function (item) {
          Cart.remove(item.itemId);
          Toast.info(item.name + ' removed from your cart.');
        };
        vm.clearCart = function () {
          Confirm({
            title: 'Empty your cart?',
            message: 'All items will be removed from your cart.',
            confirmLabel: 'Empty cart',
            danger: true
          }).then(function (ok) {
            if (ok) Cart.clear();
          });
        };

        vm.useSavedAddress = function () {
          vm.form.address = user.address || '';
          vm.form.phone = user.phone || '';
        };

        vm.placeOrder = function () {
          vm.error = '';

          if (!vm.form.address.trim()) {
            vm.error = 'Please add a delivery address so we know where to send your food.';
            return;
          }
          if (vm.form.address.trim().length < 10) {
            vm.error = 'Please enter a complete delivery address (house, street and city).';
            return;
          }
          if (!/^[0-9+\-\s]{10,15}$/.test(vm.form.phone.trim())) {
            vm.error = 'Please enter a valid phone number (10-15 digits).';
            return;
          }

          vm.placing = true;
          $http.post(API_BASE + '/orders', {
            items: Cart.items().map(function (i) { return { itemId: i.itemId, qty: i.qty }; }),
            address: vm.form.address.trim(),
            phone: vm.form.phone.trim(),
            paymentMethod: vm.form.paymentMethod
          }).then(function (res) {
            Cart.clear();
            vm.placing = false;
            Toast.success('Order ' + res.data.order.orderNumber + ' placed! We are on it.');
            $location.path('/orders');
          }).catch(function (err) {
            vm.error = errorText(err);
            vm.placing = false;
          });
        };
      }
    ])

    /* ========================================================== ORDERS */
    .controller('OrdersController', ['$http', '$interval', '$scope', 'API_BASE', 'OrderStatus', 'Toast', 'Confirm', 'errorText',
      function ($http, $interval, $scope, API_BASE, OrderStatus, Toast, Confirm, errorText) {
        var vm = this;
        var poller = null;

        vm.orders = [];
        vm.loading = true;
        vm.error = '';
        vm.filter = 'active';
        vm.status = OrderStatus;
        vm.flow = OrderStatus.flow;

        function load(silent) {
          if (!silent) vm.loading = true;
          $http.get(API_BASE + '/orders').then(function (res) {
            var expanded = {};
            vm.orders.forEach(function (o) { if (o.expanded) expanded[o._id] = true; });
            vm.orders = res.data.orders.map(function (o) {
              o.expanded = !!expanded[o._id];
              return o;
            });
            vm.loading = false;
          }).catch(function (err) {
            vm.error = errorText(err);
            vm.loading = false;
          });
        }

        vm.visible = function () {
          if (vm.filter === 'active') {
            return vm.orders.filter(function (o) {
              return o.status !== 'Delivered' && o.status !== 'Cancelled';
            });
          }
          if (vm.filter === 'past') {
            return vm.orders.filter(function (o) {
              return o.status === 'Delivered' || o.status === 'Cancelled';
            });
          }
          return vm.orders;
        };

        vm.stepIndex = function (order) { return OrderStatus.index(order.status); };
        vm.isCancellable = function (order) { return OrderStatus.isCancellable(order.status); };
        vm.toggle = function (order) { order.expanded = !order.expanded; };

        vm.cancel = function (order) {
          Confirm({
            title: 'Cancel order ' + order.orderNumber + '?',
            message: 'Your order from ' + order.restaurantName + ' will be cancelled. This cannot be undone.',
            confirmLabel: 'Cancel order',
            cancelLabel: 'Keep order',
            danger: true
          }).then(function (ok) {
            if (!ok) return;
            $http.put(API_BASE + '/orders/' + order._id + '/cancel', {}).then(function (res) {
              var index = vm.orders.map(function (o) { return o._id; }).indexOf(res.data.order._id);
              if (index !== -1) vm.orders[index] = res.data.order;
              Toast.success('Order ' + order.orderNumber + ' was cancelled.');
            }).catch(function (err) {
              Toast.error(errorText(err));
            });
          });
        };

        vm.refresh = function () {
          load(true);
          Toast.info('Order status refreshed.');
        };

        load();

        // Poll while a delivery is in progress so the tracker stays current.
        poller = $interval(function () {
          var active = vm.orders.some(function (o) {
            return o.status !== 'Delivered' && o.status !== 'Cancelled';
          });
          if (active && !document.hidden) load(true);
        }, 15000);

        $scope.$on('$destroy', function () {
          if (poller) $interval.cancel(poller);
        });
      }
    ])

    /* ========================================================= PROFILE */
    .controller('ProfileController', ['Auth', 'Toast', 'errorText',
      function (Auth, Toast, errorText) {
        var vm = this;
        var user = Auth.user() || {};

        vm.user = user;
        vm.saving = false;
        vm.form = { name: user.name, phone: user.phone, address: user.address };
        vm.stats = null;

        vm.save = function () {
          vm.saving = true;
          Auth.updateProfile({
            name: vm.form.name,
            phone: vm.form.phone,
            address: vm.form.address
          }).then(function (updated) {
            vm.user = updated;
            vm.saving = false;
            Toast.success('Profile updated. New orders will use your saved address.');
          }).catch(function (err) {
            Toast.error(errorText(err));
            vm.saving = false;
          });
        };
      }
    ])

    /* ===================================================== LOGIN / SIGNUP */
    .controller('LoginController', ['$scope', '$location', '$rootScope', 'Auth', 'API_BASE', 'Toast', 'errorText',
      function ($scope, $location, $rootScope, Auth, API_BASE, Toast, errorText) {
        var vm = this;
        vm.form = { email: '', password: '' };
        vm.busy = false;
        vm.error = '';

        vm.submit = function () {
          vm.error = '';
          if (!vm.form.email || !vm.form.password) {
            vm.error = 'Enter your email and password to sign in.';
            return;
          }
          vm.busy = true;
          Auth.login(vm.form.email, vm.form.password).then(function (user) {
            vm.busy = false;
            Toast.success('Welcome back, ' + user.name.split(' ')[0] + '!');
            var next = $rootScope.pendingRoute;
            $rootScope.pendingRoute = null;
            if (user.role === 'admin') {
              $location.path('/admin');
            } else {
              $location.path(next && next !== '/login' ? next : '/');
            }
          }).catch(function (err) {
            vm.busy = false;
            vm.error = errorText(err);
          });
        };

        vm.fill = function (role) {
          if (role === 'admin') {
            vm.form = { email: 'admin@foodapp.com', password: 'admin123' };
          } else {
            vm.form = { email: 'ravi@example.com', password: 'ravi123' };
          }
          vm.error = '';
        };
      }
    ])

    .controller('RegisterController', ['$location', 'Auth', 'Toast', 'errorText',
      function ($location, Auth, Toast, errorText) {
        var vm = this;
        vm.form = { name: '', email: '', password: '', phone: '' };
        vm.busy = false;
        vm.error = '';

        vm.submit = function () {
          vm.error = '';
          if (!vm.form.name.trim()) { vm.error = 'Please enter your full name.'; return; }
          if (!vm.form.email.trim()) { vm.error = 'Please enter your email address.'; return; }
          if (vm.form.password.length < 6) {
            vm.error = 'Choose a password with at least 6 characters.';
            return;
          }

          vm.busy = true;
          Auth.register(vm.form).then(function (user) {
            vm.busy = false;
            Toast.success('Account created. Welcome to FoodExpress, ' + user.name.split(' ')[0] + '!');
            $location.path('/');
          }).catch(function (err) {
            vm.busy = false;
            vm.error = errorText(err);
          });
        };
      }
    ]);
})();
