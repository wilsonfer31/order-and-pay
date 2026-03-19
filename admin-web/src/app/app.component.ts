import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
// NavigationEnd also imported below as NavEnd to avoid type narrowing issues
import { CommonModule }      from '@angular/common';
import { MatIconModule }     from '@angular/material/icon';
import { MatButtonModule }   from '@angular/material/button';
import { MatTooltipModule }  from '@angular/material/tooltip';
import { filter, map }       from 'rxjs/operators';
import { toSignal }          from '@angular/core/rxjs-interop';
import { NavigationEnd as NavEnd } from '@angular/router';
import { AuthService }       from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, RouterOutlet, RouterLink, RouterLinkActive,
    MatIconModule, MatButtonModule, MatTooltipModule
  ],
  template: `
@if (showShell()) {

  <div class="shell">

    <!-- Barre latérale -->
    <nav class="sidebar">
      <div class="sidebar__brand">
        <div class="sidebar__logo">
          <mat-icon>restaurant_menu</mat-icon>
        </div>
        <div class="sidebar__brand-text">
          <span class="sidebar__name">Order & Pay</span>
          <span class="sidebar__role">{{ auth.getRole() }}</span>
        </div>
      </div>

      <ul class="sidebar__nav">
        <li>
          <a routerLink="/dashboard" routerLinkActive="active" class="nav-item">
            <mat-icon>dashboard</mat-icon>
            <span>Dashboard</span>
          </a>
        </li>
        <li>
          <a routerLink="/menu" routerLinkActive="active" class="nav-item">
            <mat-icon>menu_book</mat-icon>
            <span>Menu</span>
          </a>
        </li>
        <li>
          <a routerLink="/floor/default" routerLinkActive="active" class="nav-item">
            <mat-icon>table_restaurant</mat-icon>
            <span>Plan de salle</span>
          </a>
        </li>
      </ul>

      <div class="sidebar__footer">
        <button class="nav-item nav-item--logout" (click)="auth.logout()">
          <mat-icon>logout</mat-icon>
          <span>Déconnexion</span>
        </button>
      </div>
    </nav>

    <!-- Contenu principal -->
    <main class="main-content">
      <router-outlet />
    </main>

  </div>

} @else {

  <!-- Page login sans shell -->
  <router-outlet />

}
  `,
  styles: [`
    /* ── Variables ── */
    :host {
      --sidebar-w: 224px;
      --sidebar-bg: #ffffff;
      --sidebar-border: #e5e7eb;
      --sidebar-active-bg: #eff6ff;
      --sidebar-active-color: #2563eb;
      --sidebar-text: #374151;
      --sidebar-icon: #9ca3af;
      --brand-color: #2563eb;
      --main-bg: #f9fafb;
    }

    /* ── Layout ── */
    .shell {
      display: flex;
      height: 100vh;
      background: var(--main-bg);
    }

    /* ── Sidebar ── */
    .sidebar {
      width: var(--sidebar-w);
      flex-shrink: 0;
      background: var(--sidebar-bg);
      border-right: 1px solid var(--sidebar-border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .sidebar__brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 20px 16px 16px;
      border-bottom: 1px solid var(--sidebar-border);
    }
    .sidebar__logo {
      width: 36px;
      height: 36px;
      background: var(--brand-color);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      flex-shrink: 0;
    }
    .sidebar__logo mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .sidebar__brand-text { display: flex; flex-direction: column; min-width: 0; }
    .sidebar__name  { font-weight: 700; font-size: 14px; color: #111827; white-space: nowrap; }
    .sidebar__role  { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: .04em; }

    /* ── Navigation ── */
    .sidebar__nav {
      list-style: none;
      margin: 0;
      padding: 12px 10px;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 12px;
      border-radius: 8px;
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      color: var(--sidebar-text);
      cursor: pointer;
      border: none;
      background: transparent;
      width: 100%;
      transition: background .12s, color .12s;

      mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--sidebar-icon); transition: color .12s; }

      &:hover {
        background: #f3f4f6;
        color: #111827;
        mat-icon { color: #374151; }
      }
      &.active {
        background: var(--sidebar-active-bg);
        color: var(--sidebar-active-color);
        font-weight: 600;
        mat-icon { color: var(--sidebar-active-color); }
      }
    }

    .sidebar__footer {
      padding: 10px;
      border-top: 1px solid var(--sidebar-border);
      .nav-item--logout { color: #6b7280; &:hover { background: #fef2f2; color: #dc2626; mat-icon { color: #dc2626; } } }
    }

    /* ── Main ── */
    .main-content {
      flex: 1;
      overflow: auto;
      min-width: 0;
    }
  `]
})
export class AppComponent {
  readonly auth = inject(AuthService);
  private router = inject(Router);

  /** Affiche le shell (sidebar + header) uniquement hors de la page login */
  readonly showShell = toSignal(
    this.router.events.pipe(
      filter((e): e is NavEnd => e instanceof NavigationEnd),
      map(e => !e.urlAfterRedirects.startsWith('/login'))
    ),
    { initialValue: !this.router.url.startsWith('/login') }
  );
}
