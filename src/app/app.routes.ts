import { Routes } from '@angular/router';

/**
 * Routes use `loadComponent` so each page is lazy-loaded (its code is only
 * downloaded when the user navigates to it). `title` sets the browser tab text.
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
    title: "Chloe G's Homemade Treats",
  },
  {
    path: 'menu',
    loadComponent: () => import('./pages/menu/menu').then((m) => m.Menu),
    title: 'Menu · Chloe G\'s',
  },
  {
    path: 'menu/:id',
    loadComponent: () =>
      import('./pages/item-detail/item-detail').then((m) => m.ItemDetail),
    title: 'Item · Chloe G\'s',
  },
  {
    path: 'schedule',
    loadComponent: () => import('./pages/schedule/schedule').then((m) => m.Schedule),
    title: 'Schedule · Chloe G\'s',
  },
  {
    path: 'about',
    loadComponent: () => import('./pages/about/about').then((m) => m.About),
    title: 'About · Chloe G\'s',
  },
  {
    path: 'cart',
    loadComponent: () => import('./pages/cart/cart').then((m) => m.Cart),
    title: 'Cart · Chloe G\'s',
  },
  {
    path: 'checkout',
    loadComponent: () => import('./pages/checkout/checkout').then((m) => m.Checkout),
    title: 'Checkout · Chloe G\'s',
  },
  {
    path: 'order/:orderNumber',
    loadComponent: () =>
      import('./pages/confirmation/confirmation').then((m) => m.Confirmation),
    title: 'Order Confirmed · Chloe G\'s',
  },
  {
    path: 'admin',
    loadChildren: () => import('./pages/admin/admin.routes').then((m) => m.adminRoutes),
  },
  // Unknown URLs go home.
  { path: '**', redirectTo: '' },
];
