import { Component, signal, inject } from '@angular/core';
import { ViewWillEnter }           from '@ionic/angular';
import { CommonModule }             from '@angular/common';
import { ActivatedRoute }           from '@angular/router';
import { HttpClient }               from '@angular/common/http';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonSpinner, IonButton, IonIcon, IonRefresher, IonRefresherContent,
  IonBadge
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { wineOutline, checkmarkCircle, timeOutline, refreshOutline } from 'ionicons/icons';

interface BarLine {
  id: string;
  productName: string;
  quantity: number;
  status: 'PENDING' | 'READY';
  notes?: string | null;
}

interface BarOrder {
  orderId: string;
  orderNumber: number | null;
  tableLabel: string;
  confirmedAt?: string | null;
  lines: BarLine[];
}

@Component({
  selector: 'app-bar',
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonSpinner, IonButton, IonIcon, IonRefresher, IonRefresherContent, IonBadge
  ],
  template: `
<ion-header>
  <ion-toolbar color="primary">
    <ion-buttons slot="start">
      <ion-back-button defaultHref="/menu"></ion-back-button>
    </ion-buttons>
    <ion-title>
      <ion-icon name="wine-outline" style="vertical-align:middle;margin-right:6px"></ion-icon>
      Bar
    </ion-title>
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
      <ion-icon name="wine-outline"></ion-icon>
      <p>Aucune boisson en attente.</p>
    </div>
  } @else {
    <div class="bar-list">
      @for (order of orders(); track order.orderId) {
        <div class="order-block">
          <div class="order-block__header">
            <span class="order-block__table">Table {{ order.tableLabel }}</span>
            @if (order.orderNumber) {
              <span class="order-block__num">#{{ order.orderNumber }}</span>
            }
            <ion-badge color="primary" class="order-block__count">
              {{ order.lines.length }} boisson{{ order.lines.length > 1 ? 's' : '' }}
            </ion-badge>
          </div>

          @for (line of order.lines; track line.id) {
            <div class="line-row" [class.line-row--ready]="line.status === 'READY'">
              <div class="line-info">
                <span class="line-qty">{{ line.quantity }}×</span>
                <span class="line-name">{{ line.productName }}</span>
                @if (line.notes) {
                  <span class="line-notes">{{ line.notes }}</span>
                }
              </div>
              @if (line.status === 'READY') {
                <div class="line-done">
                  <ion-icon name="checkmark-circle" color="success"></ion-icon>
                  <span>Prêt</span>
                </div>
              } @else {
                <ion-button size="small" fill="solid" color="success"
                            (click)="markReady(order, line)"
                            [disabled]="pendingIds().has(line.id)">
                  @if (pendingIds().has(line.id)) {
                    <ion-spinner name="crescent" style="width:16px;height:16px"></ion-spinner>
                  } @else {
                    <ion-icon slot="start" name="checkmark-circle"></ion-icon>
                    Prêt
                  }
                </ion-button>
              }
            </div>
          }
        </div>
      }
    </div>
  }

</ion-content>
  `,
  styles: [`
    .center-spinner { display: flex; justify-content: center; padding: 60px; }
    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; height: 50vh; gap: 16px;
      ion-icon { font-size: 64px; color: #D1D5DB; }
      p { font-size: 15px; color: #9CA3AF; }
    }

    .bar-list { padding: 12px 16px; display: flex; flex-direction: column; gap: 12px; }

    .order-block {
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,.06);
      overflow: hidden;
    }
    .order-block__header {
      display: flex; align-items: center; gap: 8px;
      padding: 12px 16px;
      background: #f0f9ff;
      border-bottom: 1px solid #bae6fd;
    }
    .order-block__table { font-size: 16px; font-weight: 800; color: #0c4a6e; }
    .order-block__num   { font-size: 12px; color: #0369a1; background: #e0f2fe; padding: 2px 8px; border-radius: 8px; }
    .order-block__count { margin-left: auto; }

    .line-row {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 16px;
      border-bottom: 1px solid #f1f5f9;
      &:last-child { border-bottom: none; }
    }
    .line-row--ready { opacity: .6; }
    .line-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .line-qty  { font-size: 18px; font-weight: 800; color: #0369a1; }
    .line-name { font-size: 15px; font-weight: 600; color: #1e293b; }
    .line-notes { font-size: 12px; color: #64748b; font-style: italic; }

    .line-done {
      display: flex; align-items: center; gap: 4px;
      font-size: 13px; font-weight: 600; color: #16a34a;
      ion-icon { font-size: 18px; }
    }
  `]
})
export class BarPage implements ViewWillEnter {
  private route  = inject(ActivatedRoute);
  private http   = inject(HttpClient);

  tableToken = '';
  orders     = signal<BarOrder[]>([]);
  loading    = signal(true);
  pendingIds = signal<Set<string>>(new Set());

  constructor() {
    addIcons({ wineOutline, checkmarkCircle, timeOutline, refreshOutline });
  }

  ionViewWillEnter(): void {
    this.tableToken = this.route.snapshot.queryParams['t'] ?? '';
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.http.get<BarOrder[]>('/public/bar', { params: { t: this.tableToken } }).subscribe({
      next: orders => { this.orders.set(orders); this.loading.set(false); },
      error: ()     => this.loading.set(false)
    });
  }

  markReady(order: BarOrder, line: BarLine): void {
    this.pendingIds.update(s => new Set([...s, line.id]));
    this.http.patch<any>(
      `/public/bar/orders/${order.orderId}/lines/${line.id}/ready`,
      null,
      { params: { t: this.tableToken } }
    ).subscribe({
      next: () => {
        this.orders.update(list =>
          list.map(o => o.orderId !== order.orderId ? o : {
            ...o,
            lines: o.lines.map(l => l.id === line.id ? { ...l, status: 'READY' as const } : l)
          })
        );
        this.pendingIds.update(s => { const n = new Set(s); n.delete(line.id); return n; });
      },
      error: () => {
        this.pendingIds.update(s => { const n = new Set(s); n.delete(line.id); return n; });
      }
    });
  }

  refresh(event: any): void {
    this.http.get<BarOrder[]>('/public/bar', { params: { t: this.tableToken } }).subscribe({
      next: orders => { this.orders.set(orders); event.target.complete(); },
      error: ()     => event.target.complete()
    });
  }
}
