(function () {
  'use strict';

  angular
    .module('foodExpress', ['ngRoute'])
    .config(['$routeProvider', '$httpProvider', '$locationProvider',
      function ($routeProvider, $httpProvider, $locationProvider) {
        $httpProvider.interceptors.push('AuthInterceptor');
        $locationProvider.hashPrefix('');

        $routeProvider
          .when('/', {
            templateUrl: 'views/home.html',
            controller: 'HomeController',
            controllerAs: 'vm',
            title: 'Order food online'
          })
          .when('/restaurant/:id', {
            templateUrl: 'views/restaurant.html',
            controller: 'RestaurantController',
            controllerAs: 'vm',
            title: 'Menu'
          })
          .when('/cart', {
            templateUrl: 'views/checkout.html',
            controller: 'CheckoutController',
            controllerAs: 'vm',
            title: 'Your cart',
            roles: ['customer', 'admin']
          })
          .when('/checkout', { redirectTo: '/cart' })
          .when('/orders', {
            templateUrl: 'views/orders.html',
            controller: 'OrdersController',
            controllerAs: 'vm',
            title: 'My orders',
            roles: ['customer', 'admin']
          })
          .when('/profile', {
            templateUrl: 'views/profile.html',
            controller: 'ProfileController',
            controllerAs: 'vm',
            title: 'Profile',
            roles: ['customer', 'admin']
          })
          .when('/login', {
            templateUrl: 'views/login.html',
            controller: 'LoginController',
            controllerAs: 'vm',
            title: 'Sign in'
          })
          .when('/signup', {
            templateUrl: 'views/signup.html',
            controller: 'RegisterController',
            controllerAs: 'vm',
            title: 'Create account'
          })
          .when('/admin', {
            templateUrl: 'views/admin.html',
            controller: 'AdminController',
            controllerAs: 'vm',
            title: 'Admin dashboard',
            roles: ['admin'],
            reloadOnSearch: false
          })
          .otherwise({ redirectTo: '/' });
      }
    ])
    .run(['$rootScope', '$location', 'Auth', 'Toast',
      function ($rootScope, $location, Auth, Toast) {
        // Route guard: protected routes need a session, admin routes need the admin role.
        $rootScope.$on('$routeChangeStart', function (event, next) {
          var route = next && next.$$route;
          if (!route || !route.roles) return;

          Auth.restore();

          if (!Auth.isLoggedIn()) {
            event.preventDefault();
            $rootScope.pendingRoute = route.originalPath;
            $location.path('/login');
            Toast.info('Please sign in to continue.');
            return;
          }

          // `roles` lists who may enter; admin-only routes simply list ['admin'].
          var role = Auth.user() ? Auth.user().role : 'customer';
          if (route.roles.indexOf(role) === -1) {
            event.preventDefault();
            $location.path('/');
            Toast.error(role === 'admin'
              ? 'That page is for customers. Use the admin dashboard instead.'
              : 'That area is for administrators only.');
          }
        });

        $rootScope.$on('$routeChangeSuccess', function (event, current) {
          var title = current && current.$$route && current.$$route.title;
          document.title = title ? title + ' · FoodExpress' : 'FoodExpress';
          window.scrollTo(0, 0);
        });

        $rootScope.$on('auth:expired', function () {
          Toast.error('Your session expired. Please sign in again.');
          $location.path('/login');
        });
      }
    ])
    .controller('AppController', ['$rootScope', '$location', 'Auth', 'Cart', 'Toast',
      function ($rootScope, $location, Auth, Cart, Toast) {
        var vm = this;
        vm.year = new Date().getFullYear();
        vm.menuOpen = false;

        function syncUser() {
          vm.user = Auth.user();
          vm.admin = Auth.isAdmin();
        }

        function syncCart() {
          vm.cartCount = Cart.count();
        }

        vm.isAdmin = function () { return vm.admin; };
        vm.isLoggedIn = function () { return !!vm.user; };
        vm.initials = function () {
          if (!vm.user || !vm.user.name) return '?';
          return vm.user.name
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map(function (part) { return part.charAt(0).toUpperCase(); })
            .join('');
        };
        vm.isActive = function (path) {
          var current = $location.path();
          if (path === '/') return current === '/';
          return current.indexOf(path) === 0;
        };
        vm.toggleMenu = function (event) {
          if (event) event.stopPropagation();
          vm.menuOpen = !vm.menuOpen;
        };
        vm.signOut = function () {
          Auth.logout();
          Cart.clear();
          vm.menuOpen = false;
          Toast.success('You have been signed out.');
          $location.path('/');
        };
        vm.dismissToast = function (id) { Toast.remove(id); };

        $rootScope.$on('auth:changed', syncUser);
        $rootScope.$on('cart:changed', syncCart);
        $rootScope.$on('$routeChangeSuccess', function () { vm.menuOpen = false; });

        document.addEventListener('click', function () {
          if (vm.menuOpen) {
            vm.menuOpen = false;
            if (!$rootScope.$$phase) $rootScope.$applyAsync();
          }
        });

        Auth.restore();
        syncUser();
        syncCart();
      }
    ])
    .filter('money', function () {
      return function (value) {
        var amount = Number(value) || 0;
        return '₹' + amount.toLocaleString('en-IN');
      };
    })
    .filter('timeAgo', function () {
      return function (value) {
        if (!value) return '';
        var diff = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
        if (diff < 60) return 'just now';
        if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
        if (diff < 86400) return Math.floor(diff / 3600) + ' hr ago';
        if (diff < 604800) return Math.floor(diff / 86400) + ' d ago';
        return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      };
    })
    .filter('clockTime', function () {
      return function (value) {
        if (!value) return '';
        return new Date(value).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
      };
    });
})();
