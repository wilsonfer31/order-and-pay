import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'floor/:id',
    loadComponent: () => import('./features/floor-editor/floor-editor.component').then(m => m.FloorEditorComponent),
    canActivate: [authGuard]
  },
  {
    path: 'menu',
    loadComponent: () => import('./features/menu-cms/menu-cms.component').then(m => m.MenuCmsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'kitchen',
    loadComponent: () => import('./features/kitchen/kitchen.component').then(m => m.KitchenComponent),
    canActivate: [authGuard]
  },
  {
    path: 'orders',
    loadComponent: () => import('./features/orders/orders-history.component').then(m => m.OrdersHistoryComponent),
    canActivate: [authGuard]
  },
  { path: '**', redirectTo: 'dashboard' }
];
