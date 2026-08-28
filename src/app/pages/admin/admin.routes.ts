import { Routes } from '@angular/router';
import { adminGuard } from '../../guards/admin.guard';

export const adminRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login').then((m) => m.Login),
    title: "Admin Login · Chloe G's",
  },
  {
    path: '',
    canActivate: [adminGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard),
        title: "Admin · Chloe G's",
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./config/config-editor/config-editor').then((m) => m.ConfigEditor),
        title: "Settings · Admin",
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./orders/order-list/order-list').then((m) => m.OrderList),
        title: "Orders · Admin",
      },
      {
        path: 'events',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./events/event-list/event-list').then((m) => m.EventList),
            title: "Events · Admin",
          },
          {
            path: 'new',
            loadComponent: () =>
              import('./events/event-form/event-form').then((m) => m.EventForm),
            title: "New Event · Admin",
          },
          {
            path: ':id/edit',
            loadComponent: () =>
              import('./events/event-form/event-form').then((m) => m.EventForm),
            title: "Edit Event · Admin",
          },
        ],
      },
      {
        path: 'menu',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./menu/menu-list/menu-list').then((m) => m.MenuList),
            title: "Menu Items · Admin",
          },
          {
            path: 'new',
            loadComponent: () =>
              import('./menu/menu-form/menu-form').then((m) => m.MenuForm),
            title: "New Item · Admin",
          },
          {
            path: ':id/edit',
            loadComponent: () =>
              import('./menu/menu-form/menu-form').then((m) => m.MenuForm),
            title: "Edit Item · Admin",
          },
        ],
      },
    ],
  },
];
