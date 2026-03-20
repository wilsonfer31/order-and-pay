import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { WebSocketService } from '../../core/services/websocket.service';
import { AuthService } from '../../core/services/auth.service';
import { Subject, takeUntil } from 'rxjs';

interface KitchenLine {
  id: string;
  productName: string;
  quantity: number;
  status: 'PENDING' | 'COOKING' | 'READY' | 'SERVED';
  notes?: string;
}

interface KitchenOrder {
  orderId: string;
  orderNumber: number | null;
  tableLabel: string;
  status: 'CONFIRMED' | 'IN_PROGRESS' | 'READY' | 'DELIVERED';
  totalTtc: number;
  confirmedAt: string | null;
  lines: KitchenLine[];
}

@Component({
  selector: 'app-kitchen',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatChipsModule, MatCardModule],
  template: `
<div class="kitchen-shell">

  <div class="kitchen-header">
    <div class="kitchen-header__left">
      <mat-icon>restaurant</mat-icon>
      <h1>Vue cuisine</h1>
    </div>
    <div class="kitchen-header__right">
      <span class="ws-dot" [class.ws-dot--on]="wsConnected()"></span>
      <span class="ws-label">{{ wsConnected() ? 'Temps réel' : 'Déconnecté' }}</span>
    </div>
  </div>

  <div class="kanban">

    <!-- Colonne Nouvelles -->
    <div class="col">
      <div class="col__header col__header--new">
        <mat-icon>fiber_new</mat-icon>
        Nouvelles
        <span class="col__count">{{ confirmed().length }}</span>
      </div>
      @for (order of confirmed(); track order.orderId) {
        <div class="card card--new">
          <div class="card__top">
            <span class="card__table">{{ order.tableLabel }}</span>
            @if (order.orderNumber) {
              <span class="card__num">#{{ order.orderNumber }}</span>
            }
          </div>
          <ul class="card__lines">
            @for (line of order.lines; track line.id) {
              <li><b>{{ line.quantity }}×</b> {{ line.productName }}
                @if (line.notes) { <span class="line-note">{{ line.notes }}</span> }
              </li>
            }
          </ul>
          <button class="action-btn action-btn--primary" (click)="takeOrder(order)">
            <mat-icon>check</mat-icon> Prendre en charge
          </button>
        </div>
      }
      @if (confirmed().length === 0) {
        <div class="col__empty">Aucune nouvelle commande</div>
      }
    </div>

    <!-- Colonne En cours -->
    <div class="col">
      <div class="col__header col__header--progress">
        <mat-icon>soup_kitchen</mat-icon>
        En préparation
        <span class="col__count">{{ inProgress().length }}</span>
      </div>
      @for (order of inProgress(); track order.orderId) {
        <div class="card card--progress">
          <div class="card__top">
            <span class="card__table">{{ order.tableLabel }}</span>
            @if (order.orderNumber) {
              <span class="card__num">#{{ order.orderNumber }}</span>
            }
          </div>
          <ul class="card__lines card__lines--interactive">
            @for (line of order.lines; track line.id) {
              <li class="line-row">
                <span class="line-text"><b>{{ line.quantity }}×</b> {{ line.productName }}</span>
                <span class="line-status-badge" [class]="'line-badge--' + line.status.toLowerCase()">
                  {{ lineLabel(line.status) }}
                </span>
                @if (line.status === 'PENDING') {
                  <button class="line-btn" (click)="setLineStatus(order, line, 'COOKING')">▶ Lancer</button>
                } @else if (line.status === 'COOKING') {
                  <button class="line-btn line-btn--ready" (click)="setLineStatus(order, line, 'READY')">✓ Prêt</button>
                }
              </li>
            }
          </ul>
        </div>
      }
      @if (inProgress().length === 0) {
        <div class="col__empty">Aucune commande en préparation</div>
      }
    </div>

    <!-- Colonne Prêtes -->
    <div class="col">
      <div class="col__header col__header--ready">
        <mat-icon>done_all</mat-icon>
        Prêtes à servir
        <span class="col__count">{{ ready().length }}</span>
      </div>
      @for (order of ready(); track order.orderId) {
        <div class="card card--ready">
          <div class="card__top">
            <span class="card__table">{{ order.tableLabel }}</span>
            @if (order.orderNumber) {
              <span class="card__num">#{{ order.orderNumber }}</span>
            }
          </div>
          <ul class="card__lines">
            @for (line of order.lines; track line.id) {
              <li><b>{{ line.quantity }}×</b> {{ line.productName }}</li>
            }
          </ul>
          <button class="action-btn action-btn--success" (click)="deliverOrder(order)">
            <mat-icon>delivery_dining</mat-icon> Marquer servie
          </button>
        </div>
      }
      @if (ready().length === 0) {
        <div class="col__empty">Aucune commande prête</div>
      }
    </div>

  </div>

</div>
  `,
  styles: [`
    .kitchen-shell {
      height: 100vh; display: flex; flex-direction: column;
      background: #0f172a; color: #f1f5f9;
    }
    .kitchen-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 24px; background: #1e293b;
      border-bottom: 1px solid #334155;
    }
    .kitchen-header__left { display: flex; align-items: center; gap: 10px; }
    .kitchen-header__left h1 { margin: 0; font-size: 20px; font-weight: 700; }
    .kitchen-header__left mat-icon { font-size: 24px; color: #f59e0b; }
    .kitchen-header__right { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #94a3b8; }
    .ws-dot { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; }
    .ws-dot--on { background: #22c55e; box-shadow: 0 0 6px #22c55e; }

    .kanban {
      display: grid; grid-template-columns: repeat(3, 1fr);
      gap: 16px; padding: 20px 24px; flex: 1; overflow-y: auto;
      align-content: start;
    }

    .col__header {
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .06em; padding: 10px 14px;
      border-radius: 10px 10px 0 0;
    }
    .col__header--new      { background: #1e3a5f; color: #93c5fd; }
    .col__header--progress { background: #451a03; color: #fcd34d; }
    .col__header--ready    { background: #14532d; color: #86efac; }
    .col__count {
      margin-left: auto; background: rgba(255,255,255,.15);
      border-radius: 12px; padding: 2px 8px; font-size: 12px;
    }
    .col__empty { text-align: center; color: #475569; padding: 32px 16px; font-size: 14px; }

    .card {
      background: #1e293b; border-radius: 0 0 10px 10px;
      padding: 14px; margin-bottom: 12px;
      border: 1px solid #334155; border-top: none;
    }
    .card--new      { border-color: #1d4ed8; }
    .card--progress { border-color: #b45309; }
    .card--ready    { border-color: #15803d; box-shadow: 0 0 12px rgba(34,197,94,.2); }

    .card__top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .card__table { font-size: 18px; font-weight: 800; color: #f8fafc; }
    .card__num   { font-size: 12px; color: #64748b; background: #0f172a; padding: 2px 8px; border-radius: 8px; }

    .card__lines { list-style: none; margin: 0 0 12px; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    .card__lines li { font-size: 14px; color: #cbd5e1; }
    .line-note { font-size: 11px; color: #94a3b8; margin-left: 6px; font-style: italic; }

    .card__lines--interactive li { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 8px; }
    .line-text { font-size: 13px; color: #cbd5e1; }
    .line-status-badge {
      font-size: 10px; font-weight: 700; padding: 2px 7px;
      border-radius: 10px; text-transform: uppercase; letter-spacing: .04em;
    }
    .line-badge--pending  { background: #1e3a5f; color: #93c5fd; }
    .line-badge--cooking  { background: #451a03; color: #fcd34d; }
    .line-badge--ready    { background: #14532d; color: #86efac; }
    .line-badge--served   { background: #1e293b; color: #64748b; }

    .line-btn {
      font-size: 11px; font-weight: 700; padding: 3px 10px;
      border-radius: 6px; border: none; cursor: pointer;
      background: #334155; color: #e2e8f0;
    }
    .line-btn:hover { background: #475569; }
    .line-btn--ready { background: #14532d; color: #86efac; }
    .line-btn--ready:hover { background: #166534; }

    .action-btn {
      display: flex; align-items: center; gap: 6px;
      width: 100%; padding: 10px 14px;
      border-radius: 8px; border: none; cursor: pointer;
      font-size: 13px; font-weight: 700;
    }
    .action-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .action-btn--primary { background: #1d4ed8; color: white; }
    .action-btn--primary:hover { background: #1e40af; }
    .action-btn--success { background: #15803d; color: white; }
    .action-btn--success:hover { background: #166534; }
  `]
})
export class KitchenComponent implements OnInit, OnDestroy {
  private http    = inject(HttpClient);
  private ws      = inject(WebSocketService);
  private auth    = inject(AuthService);
  private destroy$ = new Subject<void>();

  orders      = signal<KitchenOrder[]>([]);
  wsConnected = signal(false);

  confirmed  = computed(() => this.orders().filter(o => o.status === 'CONFIRMED'));
  inProgress = computed(() => this.orders().filter(o => o.status === 'IN_PROGRESS'));
  ready      = computed(() => this.orders().filter(o => o.status === 'READY'));

  ngOnInit(): void {
    this.loadOrders();
    this.ws.connect();
    this.ws.connected$.pipe(takeUntil(this.destroy$)).subscribe(v => this.wsConnected.set(v));

    const restaurantId = this.auth.getRestaurantId();
    if (restaurantId) {
      this.ws.kitchenEvents$(restaurantId)
        .pipe(takeUntil(this.destroy$))
        .subscribe(event => this.applyEvent(event));
    }
  }

  private loadOrders(): void {
    this.http.get<KitchenOrder[]>('/orders').subscribe({
      next: orders => this.orders.set(orders),
      error: () => {}
    });
  }

  private applyEvent(event: any): void {
    if (event.eventType === 'ORDER_CREATED') {
      this.loadOrders();
    } else if (event.eventType === 'ORDER_STATUS_CHANGED') {
      this.orders.update(list =>
        list.map(o => o.orderId === event.orderId ? { ...o, status: event.orderStatus } : o)
          .filter(o => o.status !== 'DELIVERED' && o.status !== 'PAID')
      );
    } else if (event.eventType === 'LINE_STATUS_CHANGED') {
      this.orders.update(list =>
        list.map(o => ({
          ...o,
          lines: o.lines.map(l =>
            l.id === event.lineId ? { ...l, status: event.lineStatus } : l
          )
        }))
      );
      // If all lines READY, order auto-becomes READY on backend — reload to sync
      this.loadOrders();
    }
  }

  takeOrder(order: KitchenOrder): void {
    this.http.patch(`/orders/${order.orderId}/status`, null, { params: { status: 'IN_PROGRESS' } })
      .subscribe({
        next: () => this.orders.update(list =>
          list.map(o => o.orderId === order.orderId ? { ...o, status: 'IN_PROGRESS' } : o)
        ),
        error: () => {}
      });
  }

  setLineStatus(order: KitchenOrder, line: KitchenLine, status: string): void {
    this.http.patch(`/orders/${order.orderId}/lines/${line.id}/status`, null, { params: { status } })
      .subscribe({
        next: () => {
          this.orders.update(list =>
            list.map(o => o.orderId === order.orderId ? {
              ...o,
              lines: o.lines.map(l => l.id === line.id ? { ...l, status: status as any } : l)
            } : o)
          );
          // Check if all lines ready → auto READY
          const updated = this.orders().find(o => o.orderId === order.orderId);
          if (updated && updated.lines.every(l => l.status === 'READY' || l.status === 'SERVED')) {
            this.orders.update(list =>
              list.map(o => o.orderId === order.orderId ? { ...o, status: 'READY' } : o)
            );
          }
        },
        error: () => {}
      });
  }

  deliverOrder(order: KitchenOrder): void {
    this.http.patch(`/orders/${order.orderId}/status`, null, { params: { status: 'DELIVERED' } })
      .subscribe({
        next: () => this.orders.update(list => list.filter(o => o.orderId !== order.orderId)),
        error: () => {}
      });
  }

  lineLabel(s: string): string {
    return { PENDING: 'En attente', COOKING: 'En cuisine', READY: 'Prêt', SERVED: 'Servi' }[s] ?? s;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.ws.disconnect();
  }
}
