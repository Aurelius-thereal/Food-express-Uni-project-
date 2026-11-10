(function () {
  'use strict';

  angular.module('foodExpress')

    .controller('AdminController', ['$http', '$location', '$timeout', 'API_BASE', 'OrderStatus', 'Confirm', 'Toast', 'errorText',
      function ($http, $location, $timeout, API_BASE, OrderStatus, Confirm, Toast, errorText) {
        var vm = this;
        var searchTimer = null;

        vm.tab = $location.search().tab || 'dashboard';
        vm.statuses = OrderStatus.flow.concat(['Cancelled']);
        vm.loading = true;
        vm.error = '';

        vm.stats = null;
        vm.restaurants = [];
        vm.items = [];
        vm.orders = [];
        vm.users = [];

        vm.orderStatusFilter = 'All';
        vm.orderSearch = '';
        vm.itemRestaurantId = '';
        vm.statusDraft = {};

        vm.themes = ['sunset', 'amber', 'jade', 'tomato', 'saffron', 'leaf', 'caramel', 'berry'];

        /* ------------------------------------------------------------ loading */

        vm.setTab = function (tab) {
          vm.tab = tab;
          $location.search('tab', tab === 'dashboard' ? null : tab);
          vm.load();
        };

        vm.load = function () {
          if (vm.tab === 'dashboard') loadStats();
          if (vm.tab === 'restaurants') loadRestaurants();
          if (vm.tab === 'items') loadItems();
          if (vm.tab === 'orders') loadOrders();
          if (vm.tab === 'users') loadUsers();
        };

        function fail(err) {
          vm.loading = false;
          vm.error = errorText(err);
          Toast.error(vm.error);
        }

        function loadStats() {
          vm.loading = true;
          $http.get(API_BASE + '/admin/stats').then(function (res) {
            vm.stats = res.data.stats;
            vm.loading = false;
          }).catch(fail);
        }

        function loadRestaurants() {
          vm.loading = true;
          $http.get(API_BASE + '/admin/restaurants').then(function (res) {
            vm.restaurants = res.data.restaurants;
            vm.loading = false;
          }).catch(fail);
        }

        function loadItems() {
          vm.loading = true;
          $http.get(API_BASE + '/admin/items').then(function (res) {
            vm.items = res.data.items;
            if (!vm.restaurants.length) {
              $http.get(API_BASE + '/admin/restaurants').then(function (r) {
                vm.restaurants = r.data.restaurants;
              });
            }
            vm.loading = false;
          }).catch(fail);
        }

        function loadOrders() {
          vm.loading = true;
          $http.get(API_BASE + '/admin/orders').then(function (res) {
            vm.orders = res.data.orders;
            vm.orders.forEach(function (o) {
              vm.statusDraft[o._id] = o.status;
              o.expanded = false;
            });
            vm.loading = false;
          }).catch(fail);
        }

        function loadUsers() {
          vm.loading = true;
          $http.get(API_BASE + '/admin/users').then(function (res) {
            vm.users = res.data.users;
            vm.loading = false;
          }).catch(fail);
        }

        vm.load();

        /* -------------------------------------------------------- restaurants */

        vm.restaurantModal = false;
        vm.restaurantForm = {};
        vm.editingRestaurant = null;
        vm.savingRestaurant = false;

        vm.openRestaurant = function (restaurant) {
          vm.editingRestaurant = restaurant || null;
          vm.restaurantTags = restaurant && restaurant.tags ? restaurant.tags.join(', ') : '';
          vm.restaurantForm = restaurant
            ? angular.copy(restaurant)
            : {
                name: '', cuisine: '', city: '', area: '', description: '',
                deliveryTime: '30-40 min', rating: 4.2, priceForTwo: 350,
                emoji: '🍽️', theme: 'sunset', image: '', tags: [], isOpen: true
              };
          if (!Array.isArray(vm.restaurantForm.tags)) vm.restaurantForm.tags = [];
          vm.restaurantModal = true;
        };

        vm.closeRestaurant = function () {
          vm.restaurantModal = false;
          vm.editingRestaurant = null;
        };

        vm.saveRestaurant = function () {
          vm.savingRestaurant = true;
          var payload = angular.copy(vm.restaurantForm);
          payload.tags = (vm.restaurantTags || '')
            .split(',')
            .map(function (tag) { return tag.trim(); })
            .filter(Boolean);

          var request = vm.editingRestaurant
            ? $http.put(API_BASE + '/admin/restaurants/' + vm.editingRestaurant._id, payload)
            : $http.post(API_BASE + '/admin/restaurants', payload);

          request.then(function () {
            Toast.success(vm.editingRestaurant ? 'Restaurant updated.' : 'Restaurant added.');
            vm.savingRestaurant = false;
            vm.closeRestaurant();
            loadRestaurants();
            loadItems();
          }).catch(function (err) {
            vm.savingRestaurant = false;
            Toast.error(errorText(err));
          });
        };

        vm.deleteRestaurant = function (restaurant) {
          Confirm({
            title: 'Delete ' + restaurant.name + '?',
            message: 'The restaurant and all of its menu items will be removed. Past orders keep their records.',
            confirmLabel: 'Delete restaurant',
            danger: true
          }).then(function (ok) {
            if (!ok) return;
            $http.delete(API_BASE + '/admin/restaurants/' + restaurant._id).then(function (res) {
              Toast.success(res.data.message);
              loadRestaurants();
            }).catch(function (err) { Toast.error(errorText(err)); });
          });
        };

        /* -------------------------------------------------------------- items */

        vm.itemModal = false;
        vm.itemForm = {};
        vm.editingItem = null;
        vm.savingItem = false;

        vm.openItem = function (item) {
          vm.editingItem = item || null;
          vm.itemForm = item
            ? angular.copy(item)
            : {
                name: '', restaurantId: vm.itemRestaurantId || (vm.restaurants[0] && vm.restaurants[0]._id),
                category: 'Main Course', description: '', price: 199,
                isVeg: true, isBestseller: false, isAvailable: true
              };
          vm.itemModal = true;
        };

        vm.closeItem = function () {
          vm.itemModal = false;
          vm.editingItem = null;
        };

        vm.saveItem = function () {
          vm.savingItem = true;
          var request = vm.editingItem
            ? $http.put(API_BASE + '/admin/items/' + vm.editingItem._id, vm.itemForm)
            : $http.post(API_BASE + '/admin/items', vm.itemForm);

          request.then(function () {
            Toast.success(vm.editingItem ? 'Menu item updated.' : 'Menu item added.');
            vm.savingItem = false;
            vm.closeItem();
            loadItems();
          }).catch(function (err) {
            vm.savingItem = false;
            Toast.error(errorText(err));
          });
        };

        vm.deleteItem = function (item) {
          Confirm({
            title: 'Remove ' + item.name + '?',
            message: 'This dish will be removed from the menu. ' + 'Customers will no longer see it.',
            confirmLabel: 'Remove item',
            danger: true
          }).then(function (ok) {
            if (!ok) return;
            $http.delete(API_BASE + '/admin/items/' + item._id).then(function (res) {
              Toast.success(res.data.message);
              loadItems();
            }).catch(function (err) { Toast.error(errorText(err)); });
          });
        };

        vm.filteredItems = function () {
          if (!vm.itemRestaurantId) return vm.items;
          return vm.items.filter(function (i) {
            return String(i.restaurantId) === String(vm.itemRestaurantId);
          });
        };

        vm.restaurantName = function (id) {
          var match = vm.restaurants.filter(function (r) { return r._id === id; })[0];
          return match ? match.name : 'Unassigned';
        };

        vm.restaurantEmoji = function (id) {
          var match = vm.restaurants.filter(function (r) { return r._id === id; })[0];
          return match ? match.emoji : '🍽️';
        };

        vm.restaurantTheme = function (id) {
          var match = vm.restaurants.filter(function (r) { return r._id === id; })[0];
          return match ? match.theme : 'sunset';
        };

        vm.itemCountFor = function (restaurantId) {
          return vm.items.filter(function (i) { return i.restaurantId === restaurantId; }).length;
        };

        /* ------------------------------------------------------------- orders */

        vm.onOrderSearch = function () {
          if (searchTimer) $timeout.cancel(searchTimer);
          searchTimer = $timeout(function () { loadOrders(); }, 320);
        };

        vm.setStatus = function (order, status) {
          if (!status || status === order.status) return;
          $http.put(API_BASE + '/admin/orders/' + order._id + '/status', { status: status }).then(function (res) {
            var index = vm.orders.map(function (o) { return o._id; }).indexOf(order._id);
            if (index !== -1) {
              var expanded = vm.orders[index].expanded;
              vm.orders[index] = angular.extend({}, res.data.order, { expanded: expanded });
              vm.statusDraft[order._id] = res.data.order.status;
            }
            Toast.success('Order ' + order.orderNumber + ' marked as ' + status + '.');
          }).catch(function (err) {
            vm.statusDraft[order._id] = order.status;
            Toast.error(errorText(err));
          });
        };

        vm.filteredOrders = function () {
          var status = vm.orderStatusFilter;
          var query = (vm.orderSearch || '').toLowerCase().trim();
          return vm.orders.filter(function (o) {
            if (status !== 'All' && o.status !== status) return false;
            if (!query) return true;
            var haystack = [o.orderNumber, o.restaurantName, o.address, (o.customer && o.customer.name) || '']
              .concat(o.items.map(function (i) { return i.name; }))
              .join(' ')
              .toLowerCase();
            return haystack.indexOf(query) !== -1;
          });
        };

        /* -------------------------------------------------------------- users */

        vm.deleteUser = function (user) {
          Confirm({
            title: 'Delete ' + user.name + '?',
            message: 'This customer account will be permanently removed. Their past orders stay in the system.',
            confirmLabel: 'Delete account',
            danger: true
          }).then(function (ok) {
            if (!ok) return;
            $http.delete(API_BASE + '/admin/users/' + user._id).then(function (res) {
              Toast.success(res.data.message);
              loadUsers();
            }).catch(function (err) { Toast.error(errorText(err)); });
          });
        };

        /* ----------------------------------------------------------- utilities */

        vm.refresh = function () {
          vm.load();
          Toast.info('Dashboard refreshed.');
        };

        vm.statusBadge = function (status) {
          return OrderStatus.badgeClass(status);
        };

        vm.barWidth = function (count) {
          if (!vm.stats || !vm.stats.totalOrders) return 0;
          return Math.round((count / vm.stats.totalOrders) * 100);
        };

        vm.topRestaurantWidth = function (revenue) {
          if (!vm.stats || !vm.stats.topRestaurants.length) return 0;
          var max = vm.stats.topRestaurants[0].revenue || 1;
          return Math.round((revenue / max) * 100);
        };
      }
    ]);
})();
