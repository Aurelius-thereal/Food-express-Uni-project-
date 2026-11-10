(function () {
  'use strict';

  angular.module('foodExpress')

    .constant('API_BASE', '/api')

    /* Adds the JWT to every request and clears an expired session. */
    .factory('AuthInterceptor', ['$q', '$injector', function ($q, $injector) {
      return {
        request: function (config) {
          var token = window.localStorage.getItem('fe_token');
          if (token && config.url.indexOf('/api/') !== -1) {
            config.headers = config.headers || {};
            config.headers.Authorization = 'Bearer ' + token;
          }
          return config;
        },
        responseError: function (response) {
          if (response.status === 401) {
            var Auth = $injector.get('Auth');
            if (Auth.isLoggedIn()) {
              Auth.logout();
              $injector.get('$rootScope').$broadcast('auth:expired');
            }
          }
          return $q.reject(response);
        }
      };
    }])

    /* Session state persisted in localStorage so a refresh keeps you signed in. */
    .factory('Auth', ['$http', '$rootScope', 'API_BASE', function ($http, $rootScope, API_BASE) {
      var TOKEN_KEY = 'fe_token';
      var USER_KEY = 'fe_user';
      var state = { token: null, user: null };

      function readUser() {
        try {
          return JSON.parse(window.localStorage.getItem(USER_KEY) || 'null');
        } catch (err) {
          return null;
        }
      }

      function persist(token, user) {
        state.token = token;
        state.user = user;
        window.localStorage.setItem(TOKEN_KEY, token);
        window.localStorage.setItem(USER_KEY, JSON.stringify(user));
        $rootScope.$broadcast('auth:changed');
      }

      var service = {
        restore: function () {
          state.token = window.localStorage.getItem(TOKEN_KEY);
          state.user = readUser();
          if (!state.token) state.user = null;
          $rootScope.$broadcast('auth:changed');
          return state.user;
        },
        user: function () { return state.user; },
        isLoggedIn: function () { return !!state.token; },
        isAdmin: function () { return !!state.user && state.user.role === 'admin'; },

        login: function (email, password) {
          return $http.post(API_BASE + '/auth/login', { email: email, password: password })
            .then(function (res) {
              persist(res.data.token, res.data.user);
              return res.data.user;
            });
        },
        register: function (payload) {
          return $http.post(API_BASE + '/auth/register', payload)
            .then(function (res) {
              persist(res.data.token, res.data.user);
              return res.data.user;
            });
        },
        updateProfile: function (payload) {
          return $http.put(API_BASE + '/auth/profile', payload).then(function (res) {
            state.user = res.data.user;
            window.localStorage.setItem(USER_KEY, JSON.stringify(state.user));
            $rootScope.$broadcast('auth:changed');
            return state.user;
          });
        },
        logout: function () {
          state.token = null;
          state.user = null;
          window.localStorage.removeItem(TOKEN_KEY);
          window.localStorage.removeItem(USER_KEY);
          $rootScope.$broadcast('auth:changed');
        }
      };

      service.restore();
      return service;
    }])

    /* Cart with localStorage persistence and one-restaurant-at-a-time rule. */
    .factory('Cart', ['$rootScope', function ($rootScope) {
      var KEY = 'fe_cart';
      var items = [];

      function read() {
        try {
          var parsed = JSON.parse(window.localStorage.getItem(KEY) || '[]');
          return Array.isArray(parsed) ? parsed : [];
        } catch (err) {
          return [];
        }
      }

      function commit() {
        window.localStorage.setItem(KEY, JSON.stringify(items));
        $rootScope.$broadcast('cart:changed');
      }

      function find(itemId) {
        return items.filter(function (i) { return String(i.itemId) === String(itemId); })[0];
      }

      items = read();

      return {
        items: function () { return items; },
        count: function () {
          return items.reduce(function (sum, i) { return sum + i.qty; }, 0);
        },
        subtotal: function () {
          return items.reduce(function (sum, i) { return sum + i.price * i.qty; }, 0);
        },
        restaurant: function () {
          if (!items.length) return null;
          return {
            _id: items[0].restaurantId,
            name: items[0].restaurantName,
            emoji: items[0].restaurantEmoji,
            theme: items[0].restaurantTheme
          };
        },
        qtyOf: function (itemId) {
          var line = find(itemId);
          return line ? line.qty : 0;
        },
        add: function (item, restaurant) {
          var current = items[0];
          if (current && String(current.restaurantId) !== String(restaurant._id)) {
            return false;
          }
          var line = find(item._id);
          if (line) {
            if (line.qty >= 20) return true;
            line.qty += 1;
          } else {
            items.push({
              itemId: item._id,
              name: item.name,
              price: item.price,
              qty: 1,
              isVeg: item.isVeg,
              restaurantId: restaurant._id,
              restaurantName: restaurant.name,
              restaurantEmoji: restaurant.emoji,
              restaurantTheme: restaurant.theme
            });
          }
          commit();
          return true;
        },
        setQty: function (itemId, qty) {
          var line = find(itemId);
          if (!line) return;
          var next = Math.floor(Number(qty));
          if (!next || next < 1) {
            this.remove(itemId);
            return;
          }
          line.qty = Math.min(20, next);
          commit();
        },
        increment: function (itemId) {
          var line = find(itemId);
          if (line) this.setQty(itemId, line.qty + 1);
        },
        decrement: function (itemId) {
          var line = find(itemId);
          if (line) this.setQty(itemId, line.qty - 1);
        },
        remove: function (itemId) {
          // Mutate in place so controllers holding a reference to this array stay in sync.
          for (var i = items.length - 1; i >= 0; i -= 1) {
            if (String(items[i].itemId) === String(itemId)) items.splice(i, 1);
          }
          commit();
        },
        clear: function () {
          items.splice(0, items.length);
          commit();
        }
      };
    }])

    /* Order totals — mirrors the server-side GST / delivery calculation. */
    .factory('Totals', function () {
      var GST_PERCENT = 5;
      var DELIVERY_FEE = 29;
      var FREE_DELIVERY_ABOVE = 499;

      return {
        calc: function (subtotal) {
          var gst = Math.round((subtotal * GST_PERCENT) / 100);
          var deliveryFee = subtotal >= FREE_DELIVERY_ABOVE ? 0 : (subtotal > 0 ? DELIVERY_FEE : 0);
          return {
            subtotal: subtotal,
            gst: gst,
            deliveryFee: deliveryFee,
            total: subtotal + gst + deliveryFee,
            freeDeliveryGap: Math.max(0, FREE_DELIVERY_ABOVE - subtotal),
            gstPercent: GST_PERCENT
          };
        }
      };
    })

    .constant('ORDER_FLOW', ['Placed', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered'])

    .factory('OrderStatus', ['ORDER_FLOW', function (ORDER_FLOW) {
      var icons = {
        'Placed': '🧾',
        'Confirmed': '✅',
        'Preparing': '👨‍🍳',
        'Out for Delivery': '🛵',
        'Delivered': '🎉',
        'Cancelled': '✖'
      };
      var classes = {
        'Placed': 'badge--blue',
        'Confirmed': 'badge--soft',
        'Preparing': 'badge--amber',
        'Out for Delivery': 'badge--soft',
        'Delivered': 'badge--green',
        'Cancelled': 'badge--red'
      };
      return {
        flow: ORDER_FLOW,
        icon: function (status) { return icons[status] || '•'; },
        badgeClass: function (status) { return classes[status] || 'badge--soft'; },
        index: function (status) { return ORDER_FLOW.indexOf(status); },
        isCancellable: function (status) {
          return ['Placed', 'Confirmed', 'Preparing'].indexOf(status) !== -1;
        }
      };
    }])

    .factory('Toast', ['$rootScope', '$timeout', function ($rootScope, $timeout) {
      var seq = 0;
      $rootScope.toasts = [];

      function remove(id) {
        $rootScope.toasts = $rootScope.toasts.filter(function (t) { return t.id !== id; });
      }

      function show(text, type, icon) {
        var id = ++seq;
        $rootScope.toasts.push({ id: id, text: text, type: type || 'info', icon: icon || 'i' });
        $timeout(function () { remove(id); }, 4200);
      }

      return {
        show: show,
        success: function (text) { show(text, 'success', '✓'); },
        error: function (text) { show(text, 'error', '!'); },
        info: function (text) { show(text, 'info', 'i'); },
        remove: remove
      };
    }])

    /* Promise-based confirmation modal rendered in index.html. */
    .factory('Confirm', ['$rootScope', '$q', function ($rootScope, $q) {
      $rootScope.confirmDialog = null;

      return function (options) {
        var opts = options || {};
        var deferred = $q.defer();

        $rootScope.confirmDialog = {
          title: opts.title || 'Are you sure?',
          message: opts.message || '',
          confirmLabel: opts.confirmLabel || 'Confirm',
          cancelLabel: opts.cancelLabel || 'Cancel',
          danger: !!opts.danger,
          onConfirm: function () {
            $rootScope.confirmDialog = null;
            deferred.resolve(true);
          },
          onCancel: function () {
            $rootScope.confirmDialog = null;
            deferred.resolve(false);
          }
        };

        return deferred.promise;
      };
    }])

    /* Turns an HTTP error from the API into a readable sentence. */
    .factory('errorText', function () {
      return function (err) {
        if (err && err.data && err.data.message) return err.data.message;
        if (err && err.status === -1) return 'Cannot reach the server. Is it running?';
        return 'Something went wrong. Please try again.';
      };
    });
})();
