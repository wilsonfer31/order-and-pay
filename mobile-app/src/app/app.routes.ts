import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '',       redirectTo: 'scan', pathMatch: 'full' },
  { path: 'scan',   loadComponent: () => import('./pages/scan-qr/scan-qr.page').then(m => m.ScanQrPage) },
  { path: 'menu',   loadComponent: () => import('./pages/menu/menu.page').then(m => m.MenuPage) },
  { path: 'order-confirm', loadComponent: () => import('./pages/order-confirm/order-confirm.page').then(m => m.OrderConfirmPage) },
  { path: 'track',  loadComponent: () => import('./pages/order-tracking/order-tracking.page').then(m => m.OrderTrackingPage) },
  { path: '**',     redirectTo: 'scan' }
];
