import {
  Component, OnInit, OnDestroy,
  ChangeDetectionStrategy, signal, inject, computed
} from '@angular/core';
import { CommonModule }   from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient }     from '@angular/common/http';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonChip, IonLabel, IonIcon, IonSpinner, IonButton, IonRefresher, IonRefresherContent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  checkmarkCircle, time, timeOutline, restaurant, bicycle,
  refreshOutline, cartOutline, closeCircle
} from 'ionicons/icons';
import { RxStomp } from '@stomp/rx-stomp';
import { Subject, takeUntil } from 'rxjs';
import { map } from 'rxjs/operators';

interface TableOrderLine {
  id: string;
  productName: string;
  quantity: number;
  status: 'PENDING' | 'COOKING' | 'READY' | 'SERVED' | 'CANCELLED';
}

interface TableOrder {
  orderId: string;
  status: 'CONFIRMED' | 'IN_PROGRESS' | 'READY' | 'DELIVERED';
  totalTtc: number;
  confirmedAt?: string | null;
  lines: TableOrderLine[];
}

@Component({
  selector: 'app-table-orders',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonCard, IonCardContent, IonCardHeader, IonCardTitle,
    IonChip, IonLabel, IonIcon, IonSpinner, IonButton,
    IonRefresher, IonRefresherContent
  ],
  template: `
<ion-header>
  <ion-toolbar color="primary">
    <ion-buttons slot="start">
      <ion-back-button defaultHref="/menu"></ion-back-button>
    </ion-buttons>
    <ion-title>Suivi — {{ tableToken() }}</ion-title>
  </ion-toolbar>
</ion-header>

<ion-content>

  <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
    <ion-refresher-content></ion-refresher-content>
  </ion-refresher>

  @if (loading()) {
    <div class="center-spinner">
      <ion-spinner name="crescent" color="primary"></ion-spinner>
    </div>
  } @else if (orders().length === 0) {
    <div class="empty-state">
      <ion-icon name="cart-outline"></ion-icon>
      <p>Aucune commande en cours pour cette table.</p>
    </div>
  } @else {

    <div class="summary-bar">
      <span class="summary-count">{{ orders().length }} commande{{ orders().length > 1 ? 's' : '' }}</span>
      <span class="summary-total">Total : <strong>{{ grandTotal() | currency:'EUR':'symbol':'1.2-2':'fr' }}</strong></span>
    </div>

    @for (order of orders(); track order.orderId; let i = $index) {
      <ion-card class="order-card">
        <ion-card-header>
          <div class="order-header">
            <ion-card-title class="order-title">Commande {{ orders().length - i }}</ion-card-title>
            <ion-chip [color]="orderColor(order.status)" class="order-status-chip">
              <ion-icon [name]="orderIcon(order.status)" slot="start"></ion-icon>
              <ion-label>{{ orderLabel(order.status) }}</ion-label>
            </ion-chip>
          </div>
          @if (order.confirmedAt) {
            <div class="order-time">
              <ion-icon name="time-outline" style="font-size:13px;flex-shrink:0"></ion-icon>
              Prise à <strong>{{ formatTime(order.confirmedAt) }}</strong>
            </div>
          }
        </ion-card-header>
        <ion-card-content>
          <div class="lines-list">
            @for (line of order.lines; track line.id) {
              <div class="line-row">
                <ion-icon [name]="lineIcon(line.status)" [class]="'line-icon line-icon--' + lineColorClass(line.status)"></ion-icon>
                <span class="line-name"><b>{{ line.quantity }}×</b> {{ line.productName }}</span>
                <span class="line-badge" [class]="'line-badge--' + lineColorClass(line.status)">
                  {{ lineLabel(line.status) }}
                </span>
              </div>
            }
          </div>
          <div class="order-total">
            Total : <strong>{{ order.totalTtc | currency:'EUR':'symbol':'1.2-2':'fr' }}</strong>
          </div>
        </ion-card-content>
      </ion-card>
    }

  }

</ion-content>
  `,
  styles: [`
    .center-spinner { display: flex; justify-content: center; padding: 60px; }
    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; height: 50vh; gap: 16px; color: #D1D5DB;
      ion-icon { font-size: 64px; }
      p { font-size: 15px; color: #9CA3AF; }
    }
    .summary-bar {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 16px;
      background: linear-gradient(135deg, #FFF7ED, #FFFBF7);
      border-bottom: 1px solid #FED7AA;
      font-size: 14px; color: #78716C;
    }
    .summary-count { font-weight: 700; color: #57534E; }
    .summary-total strong { color: #F97316; }

    .order-card {
      margin: 12px 16px;
      border-radius: 16px;
      box-shadow: 0 2px 10px rgba(0,0,0,.07);
    }
    .order-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .order-title { font-size: 15px; font-weight: 700; color: #1C1917; }
    .order-status-chip { font-size: 12px; }
    .order-time {
      display: flex; align-items: center; gap: 5px;
      font-size: 12px; color: #78716C; margin-top: 6px;
      strong { color: #1C1917; }
    }

    .lines-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
    .line-row {
      display: flex; align-items: center; gap: 10px;
      padding: 7px 0; border-bottom: 1px solid #F5F5F4;
      &:last-child { border-bottom: none; }
    }
    .line-icon { font-size: 18px; flex-shrink: 0; }
    .line-icon--medium  { color: #9CA3AF; }
    .line-icon--warning { color: #F59E0B; }
    .line-icon--success { color: #10B981; }
    .line-icon--primary { color: #F97316; }
    .line-icon--danger  { color: #EF4444; }

    .line-name { flex: 1; font-size: 14px; color: #1C1917; }
    .line-badge {
      font-size: 11px; font-weight: 700; padding: 3px 10px;
      border-radius: 20px; text-transform: uppercase; letter-spacing: .04em;
    }
    .line-badge--medium  { background: #F3F4F6; color: #6B7280; }
    .line-badge--warning { background: #FEF3C7; color: #B45309; }
    .line-badge--success { background: #D1FAE5; color: #065F46; }
    .line-badge--primary { background: #FFF7ED; color: #C2410C; }
    .line-badge--danger  { background: #FEE2E2; color: #991B1B; }

    .order-total {
      text-align: right; font-size: 14px; color: #78716C;
      padding-top: 10px; border-top: 1px solid #F5F5F4;
      strong { color: #F97316; font-size: 16px; }
    }
  `]
})
export class TableOrdersPage implements OnInit, OnDestroy {
  private route   = inject(ActivatedRoute);
  private router  = inject(Router);
  private http    = inject(HttpClient);
  private destroy$ = new Subject<void>();
  private stomp   = new RxStomp();

  tableToken = signal('');
  orders     = signal<TableOrder[]>([]);
  loading    = signal(true);

  grandTotal = computed(() =>
    this.orders().reduce((sum, o) => sum + (o.totalTtc ?? 0), 0)
  );

  constructor() {
    addIcons({ checkmarkCircle, time, timeOutline, restaurant, bicycle, refreshOutline, cartOutline, closeCircle });
  }

  ngOnInit(): void {
    const t = this.route.snapshot.queryParams['t'] ?? '';
    this.tableToken.set(t);
    this.loadOrders(t);
  }

  private loadOrders(t: string): void {
    this.loading.set(true);
    this.http.get<TableOrder[]>(`/public/tables/orders`, { params: { t } }).subscribe({
      next: orders => {
        this.orders.set(orders);
        this.loading.set(false);
        this.subscribeToOrders(orders);
      },
      error: () => this.loading.set(false)
    });
  }

  private subscribeToOrders(orders: TableOrder[]): void {
    this.stomp.deactivate();
    if (orders.length === 0) return;

    this.stomp.configure({
      brokerURL: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/ws`,
      reconnectDelay: 5000,
    });
    this.stomp.activate();

    for (const order of orders) {
      this.stomp.watch(`/topic/client/${order.orderId}`)
        .pipe(map(msg => JSON.parse(msg.body)), takeUntil(this.destroy$))
        .subscribe(event => this.applyEvent(event));
    }
  }

  private applyEvent(event: any): void {
    if (event.eventType === 'ORDER_STATUS_CHANGED') {
      this.orders.update(list =>
        list.map(o => o.orderId === event.orderId ? { ...o, status: event.orderStatus } : o)
      );
    } else if (event.eventType === 'LINE_STATUS_CHANGED') {
      this.orders.update(list =>
        list.map(o => ({
          ...o,
          lines: o.lines.map(l => l.id === event.lineId ? { ...l, status: event.lineStatus } : l)
        }))
      );
    }
  }

  refresh(event: any): void {
    const t = this.tableToken();
    this.http.get<TableOrder[]>(`/public/tables/orders`, { params: { t } }).subscribe({
      next: orders => {
        this.orders.set(orders);
        this.subscribeToOrders(orders);
        event.target.complete();
      },
      error: () => event.target.complete()
    });
  }

  formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  orderLabel(s: string): string {
    return { CONFIRMED: 'Confirmée', IN_PROGRESS: 'En cuisine', READY: 'Prête', DELIVERED: 'Servie' }[s] ?? s;
  }
  orderColor(s: string): string {
    return { CONFIRMED: 'primary', IN_PROGRESS: 'warning', READY: 'success', DELIVERED: 'medium' }[s] ?? 'medium';
  }
  orderIcon(s: string): string {
    return { CONFIRMED: 'checkmark-circle', IN_PROGRESS: 'time', READY: 'restaurant', DELIVERED: 'bicycle' }[s] ?? 'time';
  }
  lineLabel(s: string): string {
    return { PENDING: 'En attente', COOKING: 'En cuisine', READY: 'Prêt', SERVED: 'Servi', CANCELLED: 'Annulé' }[s] ?? s;
  }
  lineIcon(s: string): string {
    return { PENDING: 'time', COOKING: 'restaurant', READY: 'checkmark-circle', SERVED: 'bicycle', CANCELLED: 'close-circle' }[s] ?? 'time';
  }
  lineColorClass(s: string): string {
    return { PENDING: 'medium', COOKING: 'warning', READY: 'success', SERVED: 'primary', CANCELLED: 'danger' }[s] ?? 'medium';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stomp.deactivate();
  }
}
