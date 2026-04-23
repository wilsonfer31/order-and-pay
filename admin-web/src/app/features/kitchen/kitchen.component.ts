import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, signal, inject, computed, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { WebSocketService } from '../../core/services/websocket.service';
import { AuthService } from '../../core/services/auth.service';
import { KitchenNotificationService } from '../../core/services/kitchen-notification.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { Subject, takeUntil } from 'rxjs';

interface KitchenLine {
  id: string;
  productName: string;
  quantity: number;
  status: 'PENDING' | 'COOKING' | 'READY' | 'SERVED';
  notes?: string;
  options?: string[];
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

interface KitchenTicket {
  orderId: string;
  orderNumber: number | null;
  tableLabel: string;
  confirmedAt: string | null;
  lineId: string;
  productName: string;
  quantity: number;
  lineStatus: 'PENDING' | 'COOKING' | 'READY' | 'SERVED';
  notes?: string;
  options?: string[];
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
      <span class="kitchen-clock">{{ currentTime() }}</span>
      <button class="notif-btn"
              [class.notif-btn--on]="notifPermission() === 'granted'"
              [title]="notifBtnTitle()"
              (click)="toggleNotifications()">
        <mat-icon>{{ notifPermission() === 'granted' ? 'notifications_active' : 'notifications_off' }}</mat-icon>
      </button>
      <span class="ws-dot" [class.ws-dot--on]="wsConnected()"></span>
      <span class="ws-label">{{ wsConnected() ? 'Temps réel' : 'Déconnecté' }}</span>
    </div>
  </div>

  <div class="kanban">

    <!-- Colonne À préparer -->
    <div class="col">
      <div class="col__header col__header--new">
        <mat-icon>fiber_new</mat-icon>
        À préparer
        <span class="col__count">{{ pendingTickets().length }}</span>
      </div>
      @for (ticket of pendingTickets(); track ticket.lineId) {
        <div class="card card--new"
             [class.card--warn]="urgencyClass(ticket.confirmedAt) === 'warn'"
             [class.card--danger]="urgencyClass(ticket.confirmedAt) === 'danger'">
          <div class="card__top">
            <span class="card__table">{{ ticket.tableLabel }}</span>
            @if (ticket.orderNumber) {
              <span class="card__num">#{{ ticket.orderNumber }}</span>
            }
          </div>
          <div class="card__time" [class]="'card__time--' + urgencyClass(ticket.confirmedAt)">
            <mat-icon style="font-size:13px;width:13px;height:13px">schedule</mat-icon>
            {{ formatTime(ticket.confirmedAt) }}
            <span class="card__elapsed">· {{ elapsed(ticket.confirmedAt) }}</span>
          </div>
          <div class="ticket__item">
            <span class="ticket__qty">{{ ticket.quantity }}×</span>
            <span class="ticket__name">{{ ticket.productName }}</span>
          </div>
          @if (ticket.options?.length) { <div class="ticket__options">{{ ticket.options!.join(' · ') }}</div> }
          @if (ticket.notes) { <div class="ticket__notes">{{ ticket.notes }}</div> }
          <button class="action-btn action-btn--primary" (click)="launchTicket(ticket)">
            <mat-icon>play_arrow</mat-icon> Prendre en charge
          </button>
          <button class="action-btn action-btn--cancel" (click)="cancelOrder(ticket)">
            <mat-icon>cancel</mat-icon> Annuler commande
          </button>
        </div>
      }
      @if (pendingTickets().length === 0) {
        <div class="col__empty">Aucun plat en attente</div>
      }
    </div>

    <!-- Colonne En préparation -->
    <div class="col">
      <div class="col__header col__header--progress">
        <mat-icon>soup_kitchen</mat-icon>
        En préparation
        <span class="col__count">{{ cookingTickets().length }}</span>
      </div>
      @for (ticket of cookingTickets(); track ticket.lineId) {
        <div class="card card--progress"
             [class.card--warn]="urgencyClass(ticket.confirmedAt) === 'warn'"
             [class.card--danger]="urgencyClass(ticket.confirmedAt) === 'danger'">
          <div class="card__top">
            <span class="card__table">{{ ticket.tableLabel }}</span>
            @if (ticket.orderNumber) {
              <span class="card__num">#{{ ticket.orderNumber }}</span>
            }
          </div>
          <div class="card__time" [class]="'card__time--' + urgencyClass(ticket.confirmedAt)">
            <mat-icon style="font-size:13px;width:13px;height:13px">schedule</mat-icon>
            {{ formatTime(ticket.confirmedAt) }}
            <span class="card__elapsed">· {{ elapsed(ticket.confirmedAt) }}</span>
          </div>
          <div class="ticket__item">
            <span class="ticket__qty">{{ ticket.quantity }}×</span>
            <span class="ticket__name">{{ ticket.productName }}</span>
          </div>
          @if (ticket.options?.length) { <div class="ticket__options">{{ ticket.options!.join(' · ') }}</div> }
          @if (ticket.notes) { <div class="ticket__notes">{{ ticket.notes }}</div> }
          <button class="action-btn action-btn--warn" (click)="readyTicket(ticket)">
            <mat-icon>check</mat-icon> Prêt
          </button>
          <button class="action-btn action-btn--cancel" (click)="cancelOrder(ticket)">
            <mat-icon>cancel</mat-icon> Annuler commande
          </button>
        </div>
      }
      @if (cookingTickets().length === 0) {
        <div class="col__empty">Aucun plat en préparation</div>
      }
    </div>

    <!-- Colonne Prêts à servir -->
    <div class="col">
      <div class="col__header col__header--ready">
        <mat-icon>done_all</mat-icon>
        Prêts à servir
        <span class="col__count">{{ readyTickets().length }}</span>
      </div>
      @for (ticket of readyTickets(); track ticket.lineId) {
        <div class="card card--ready">
          <div class="card__top">
            <span class="card__table">{{ ticket.tableLabel }}</span>
            @if (ticket.orderNumber) {
              <span class="card__num">#{{ ticket.orderNumber }}</span>
            }
          </div>
          <div class="card__time card__time--ok">
            <mat-icon style="font-size:13px;width:13px;height:13px">schedule</mat-icon>
            {{ formatTime(ticket.confirmedAt) }}
            <span class="card__elapsed">· {{ elapsed(ticket.confirmedAt) }}</span>
          </div>
          <div class="ticket__item">
            <span class="ticket__qty">{{ ticket.quantity }}×</span>
            <span class="ticket__name">{{ ticket.productName }}</span>
          </div>
          @if (ticket.options?.length) { <div class="ticket__options">{{ ticket.options!.join(' · ') }}</div> }
          @if (ticket.notes) { <div class="ticket__notes">{{ ticket.notes }}</div> }
          <button class="action-btn action-btn--success" (click)="serveTicket(ticket)">
            <mat-icon>delivery_dining</mat-icon> Servi
          </button>
        </div>
      }
      @if (readyTickets().length === 0) {
        <div class="col__empty">Aucun plat prêt</div>
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
    .kitchen-header__right { display: flex; align-items: center; gap: 12px; font-size: 13px; color: #94a3b8; }
    .kitchen-clock {
      font-size: 22px; font-weight: 800; color: #f8fafc;
      font-variant-numeric: tabular-nums; letter-spacing: .02em;
      padding-right: 12px; border-right: 1px solid #334155;
    }
    .ws-dot { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; }
    .ws-dot--on { background: #22c55e; box-shadow: 0 0 6px #22c55e; }
    .notif-btn {
      display: flex; align-items: center; justify-content: center;
      width: 34px; height: 34px; border-radius: 8px; border: 1px solid #334155;
      background: #1e293b; color: #64748b; cursor: pointer; transition: all .2s;
    }
    .notif-btn:hover { background: #334155; color: #94a3b8; }
    .notif-btn--on { border-color: #f59e0b; color: #f59e0b; }
    .notif-btn--on:hover { background: #451a03; }
    .notif-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }

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
    .card--warn     { border-color: #d97706 !important; box-shadow: 0 0 10px rgba(217,119,6,.3); }
    .card--danger   { border-color: #dc2626 !important; box-shadow: 0 0 14px rgba(220,38,38,.5); animation: pulse-border 1.5s infinite; }
    @keyframes pulse-border { 0%, 100% { box-shadow: 0 0 14px rgba(220,38,38,.5); } 50% { box-shadow: 0 0 24px rgba(220,38,38,.9); } }

    .card__top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
    .card__table { font-size: 18px; font-weight: 800; color: #f8fafc; }
    .card__num   { font-size: 12px; color: #64748b; background: #0f172a; padding: 2px 8px; border-radius: 8px; }

    .card__time {
      display: flex; align-items: center; gap: 4px;
      font-size: 12px; font-weight: 700;
      padding: 3px 8px; border-radius: 6px; margin-bottom: 10px;
      width: fit-content;
    }
    .card__time--ok     { background: #14532d; color: #86efac; }
    .card__time--warn   { background: #451a03; color: #fcd34d; }
    .card__time--danger { background: #7f1d1d; color: #fca5a5; animation: pulse 1.5s infinite; }
    .card__elapsed { font-weight: 400; opacity: .8; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .6; } }

    .card__lines { list-style: none; margin: 0 0 12px; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    .card__lines li { font-size: 14px; color: #cbd5e1; }
    .ticket__options { font-size: 13px; font-weight: 700; color: #fb923c; margin: 4px 0 2px; letter-spacing: .01em; }
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
    .ticket__item { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
    .ticket__qty  { font-size: 22px; font-weight: 900; color: #f59e0b; flex-shrink: 0; }
    .ticket__name { font-size: 16px; font-weight: 700; color: #f8fafc; }
    .ticket__notes { font-size: 12px; color: #94a3b8; font-style: italic; margin-bottom: 8px; }

    .action-btn--primary { background: #1d4ed8; color: white; }
    .action-btn--primary:hover { background: #1e40af; }
    .action-btn--warn    { background: #b45309; color: white; }
    .action-btn--warn:hover { background: #92400e; }
    .action-btn--success { background: #15803d; color: white; }
    .action-btn--success:hover { background: #166534; }
    .action-btn--cancel { background: #1e293b; color: #f87171; border: 1px solid #7f1d1d; margin-top: 4px; }
    .action-btn--cancel:hover { background: #7f1d1d; color: white; }
  `]
})
export class KitchenComponent implements OnInit, OnDestroy {
  private http    = inject(HttpClient);
  private dialog  = inject(MatDialog);
  private ws      = inject(WebSocketService);
  private auth    = inject(AuthService);
  private ngZone  = inject(NgZone);
  private notif   = inject(KitchenNotificationService);
  private destroy$ = new Subject<void>();

  orders         = signal<KitchenOrder[]>([]);
  wsConnected    = signal(false);
  now            = signal(Date.now());
  notifPermission = signal<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  );
  private clockInterval?: ReturnType<typeof setInterval>;

  notifBtnTitle = computed(() =>
    this.notifPermission() === 'granted'
      ? 'Notifications activées — cliquer pour info'
      : 'Activer les notifications sonores'
  );

  private toTickets(orders: KitchenOrder[]): KitchenTicket[] {
    return orders.flatMap(o =>
      o.lines
        .filter(l => l.status !== 'SERVED')
        .map(l => ({
          orderId:     o.orderId,
          orderNumber: o.orderNumber,
          tableLabel:  o.tableLabel,
          confirmedAt: o.confirmedAt,
          lineId:      l.id,
          productName: l.productName,
          quantity:    l.quantity,
          lineStatus:  l.status,
          notes:       l.notes,
          options:     l.options,
        }))
    );
  }

  currentTime = computed(() =>
    new Date(this.now()).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  formatTime(iso: string | null): string {
    if (!iso) return '--:--';
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  elapsed(iso: string | null): string {
    if (!iso) return '';
    const mins = Math.floor((this.now() - new Date(iso).getTime()) / 60_000);
    if (mins < 1)  return 'à l\'instant';
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60), m = mins % 60;
    return m > 0 ? `${h}h${m.toString().padStart(2,'0')}` : `${h}h`;
  }

  urgencyClass(iso: string | null): string {
    if (!iso) return 'ok';
    const mins = Math.floor((this.now() - new Date(iso).getTime()) / 60_000);
    if (mins >= 15) return 'danger';
    if (mins >= 7)  return 'warn';
    return 'ok';
  }

  pendingTickets = computed(() =>
    this.toTickets(this.orders()).filter(t => t.lineStatus === 'PENDING')
  );
  cookingTickets = computed(() =>
    this.toTickets(this.orders()).filter(t => t.lineStatus === 'COOKING')
  );
  readyTickets = computed(() =>
    this.toTickets(this.orders()).filter(t => t.lineStatus === 'READY')
  );

  async toggleNotifications(): Promise<void> {
    if (this.notifPermission() === 'granted') return; // déjà activé, rien à faire
    const result = await this.notif.requestPermission();
    this.notifPermission.set(result);
  }

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

    // Rafraîchit l'horloge et le temps écoulé toutes les secondes
    this.ngZone.runOutsideAngular(() => {
      this.clockInterval = setInterval(() => {
        this.ngZone.run(() => this.now.set(Date.now()));
      }, 1_000);
    });
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
      this.notif.notify(event.tableLabel ?? 'Table inconnue', event.lines);
    } else if (event.eventType === 'ORDER_STATUS_CHANGED') {
      const terminal = ['DELIVERED', 'PAID', 'CANCELLED'];
      if (terminal.includes(event.orderStatus)) {
        this.orders.update(list => list.filter(o => o.orderId !== event.orderId));
      } else {
        this.orders.update(list =>
          list.map(o => o.orderId === event.orderId ? { ...o, status: event.orderStatus } : o)
        );
      }
    } else if (event.eventType === 'LINE_STATUS_CHANGED') {
      this.orders.update(list =>
        list.map(o => {
          if (o.orderId !== event.orderId) return o;
          const updatedLines = o.lines.map(l =>
            l.id === event.lineId ? { ...l, status: event.lineStatus } : l
          );
          const allDone = updatedLines
            .filter(l => l.status !== 'SERVED')
            .every(l => l.status === 'READY' || l.status === 'SERVED');
          return {
            ...o,
            lines: updatedLines,
            status: allDone ? 'READY' : (
              event.lineStatus === 'COOKING' && o.status === 'CONFIRMED' ? 'IN_PROGRESS' : o.status
            )
          };
        })
      );
    }
  }

  private patchLineStatus(ticket: KitchenTicket, status: string): void {
    this.http.patch(`/orders/${ticket.orderId}/lines/${ticket.lineId}/status`, null, { params: { status } })
      .subscribe({
        next: () => {
          this.orders.update(list =>
            list.map(o => {
              if (o.orderId !== ticket.orderId) return o;
              const updatedLines = o.lines.map(l =>
                l.id === ticket.lineId ? { ...l, status: status as any } : l
              );
              const allDone = updatedLines
                .filter(l => l.status !== 'SERVED')
                .every(l => l.status === 'READY' || l.status === 'SERVED');
              return {
                ...o,
                lines: updatedLines,
                status: allDone ? 'READY' : (
                  status === 'COOKING' && o.status === 'CONFIRMED' ? 'IN_PROGRESS' : o.status
                )
              };
            })
          );
        },
        error: () => {}
      });
  }

  launchTicket(ticket: KitchenTicket): void  { this.patchLineStatus(ticket, 'COOKING'); }
  readyTicket(ticket: KitchenTicket): void   { this.patchLineStatus(ticket, 'READY'); }
  serveTicket(ticket: KitchenTicket): void   { this.patchLineStatus(ticket, 'SERVED'); }

  cancelOrder(ticket: KitchenTicket): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Annuler la commande',
        message: `Annuler la commande #${ticket.orderNumber ?? ''} table ${ticket.tableLabel} ? Cette action est irréversible.`,
        confirmLabel: 'Annuler la commande',
        danger: true
      }
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.http.delete(`/orders/${ticket.orderId}`).subscribe({
        next: () => {
          this.orders.update(list => list.filter(o => o.orderId !== ticket.orderId));
        },
        error: () => {}
      });
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.ws.disconnect();
    if (this.clockInterval) clearInterval(this.clockInterval);
  }
}
