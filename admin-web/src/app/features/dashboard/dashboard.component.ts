import {
  Component, OnInit, OnDestroy, AfterViewInit,
  ChangeDetectionStrategy, signal, inject, ChangeDetectorRef, ViewChild
} from '@angular/core';
import { CommonModule }      from '@angular/common';
import { HttpClient }        from '@angular/common/http';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { Subject, interval, switchMap, takeUntil, startWith, forkJoin } from 'rxjs';

import { WebSocketService, OrderEvent } from '../../core/services/websocket.service';
import { AuthService }                  from '../../core/services/auth.service';

interface TableStatus {
  id: string;
  label: string;
  status: 'FREE' | 'OCCUPIED' | 'DIRTY' | 'RESERVED';
  capacity: number;
}

interface ProfitabilityReport {
  from: string;
  to: string;
  totalOrders: number;
  totalCovers: number;
  revenueHt: number;
  revenueTtc: number;
  totalVat55: number;
  totalVat10: number;
  totalVat20: number;
  costMaterials: number;
  grossMargin: number;
  marginPercent: number;
  avgBasketTtc: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, BaseChartDirective],
  template: `
<div class="dashboard">
  <h1 class="dashboard__title">Dashboard — Aujourd'hui</h1>

  <!-- KPI Cards -->
  <div class="kpi-grid">
    <div class="kpi-card kpi-card--primary">
      <span class="kpi-card__label">CA TTC</span>
      <span class="kpi-card__value">{{ report()?.revenueTtc | currency:'EUR':'symbol':'1.2-2':'fr' }}</span>
      <span class="kpi-card__sub">{{ report()?.totalOrders }} commandes</span>
    </div>

    <div class="kpi-card">
      <span class="kpi-card__label">Panier moyen</span>
      <span class="kpi-card__value">{{ report()?.avgBasketTtc | currency:'EUR':'symbol':'1.2-2':'fr' }}</span>
      <span class="kpi-card__sub">{{ report()?.totalCovers }} couverts</span>
    </div>

    <div class="kpi-card">
      <span class="kpi-card__label">Marge brute</span>
      <span class="kpi-card__value">{{ report()?.grossMargin | currency:'EUR':'symbol':'1.2-2':'fr' }}</span>
      <span class="kpi-card__sub">{{ report()?.marginPercent | number:'1.1-1':'fr' }}%</span>
    </div>

    <div class="kpi-card kpi-card--vat">
      <span class="kpi-card__label">Décomposition TVA</span>
      <div class="vat-row"><span>5.5%</span><span>{{ report()?.totalVat55 | currency:'EUR':'symbol':'1.2-2':'fr' }}</span></div>
      <div class="vat-row"><span>10%</span> <span>{{ report()?.totalVat10 | currency:'EUR':'symbol':'1.2-2':'fr' }}</span></div>
      <div class="vat-row"><span>20%</span> <span>{{ report()?.totalVat20 | currency:'EUR':'symbol':'1.2-2':'fr' }}</span></div>
    </div>
  </div>

  <!-- Graphique CA journalier -->
  <div class="chart-card">
    <h2>Évolution du CA (30 derniers jours)</h2>
    <canvas baseChart
            [data]="revenueChartData"
            [options]="chartOptions"
            type="bar"
            style="max-height:220px">
    </canvas>
  </div>

  <!-- Vue des tables -->
  @if (tables().length > 0) {
    <div class="tables-card">
      <h2>
        État des tables
        <span class="tables-legend">
          <span class="tleg tleg--free">Libre</span>
          <span class="tleg tleg--occupied">Occupée</span>
          <span class="tleg tleg--dirty">À nettoyer</span>
          <span class="tleg tleg--reserved">Réservée</span>
        </span>
      </h2>
      <div class="tables-grid">
        @for (t of tables(); track t.id) {
          <div class="table-chip" [class]="'table-chip--' + t.status.toLowerCase()">
            <span class="table-chip__label">{{ t.label }}</span>
            <span class="table-chip__cap">{{ t.capacity }}p</span>
          </div>
        }
      </div>
    </div>
  }

  <!-- Flux temps réel -->
  <div class="realtime-feed">
    <h2>Activité en temps réel
      <span class="live-dot" [class.live-dot--on]="wsConnected()">●</span>
    </h2>
    @if (liveEvents().length === 0) {
      <p class="feed-empty">En attente d'activité…</p>
    }
    <ul>
      @for (event of liveEvents(); track event.occurredAt) {
        <li class="event-item"
            [class.event-item--clickable]="event.eventType === 'ORDER_CREATED' && event.lines?.length"
            (click)="toggleExpand(event)">
          <span class="event-icon">{{ eventIcon(event.eventType) }}</span>
          <div class="event-body">
            <div class="event-row">
              <span class="event-desc">{{ eventDesc(event) }}</span>
              <span class="event-time">{{ event.occurredAt | date:'HH:mm:ss' }}</span>
              @if (event.eventType === 'ORDER_CREATED' && event.lines?.length) {
                <span class="event-chevron">{{ expandedId() === event.occurredAt ? '▾' : '▸' }}</span>
              }
            </div>
            @if (expandedId() === event.occurredAt && event.lines?.length) {
              <ul class="order-lines">
                @for (line of event.lines!; track line.name) {
                  <li class="order-line">
                    <span class="order-line__qty">{{ line.quantity }}×</span>
                    <span class="order-line__name">{{ line.name }}</span>
                  </li>
                }
              </ul>
            }
          </div>
        </li>
      }
    </ul>
  </div>
</div>
  `,
  styles: [`
    .dashboard { padding: 24px; }
    .dashboard__title { font-size: 22px; font-weight: 700; margin-bottom: 24px; }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }

    .kpi-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,.08);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .kpi-card--primary { background: #3f51b5; color: white; }
    .kpi-card__label   { font-size: 12px; text-transform: uppercase; opacity: .7; }
    .kpi-card__value   { font-size: 28px; font-weight: 800; }
    .kpi-card__sub     { font-size: 12px; opacity: .7; }

    .vat-row { display: flex; justify-content: space-between; font-size: 13px; margin-top: 4px; }

    .chart-card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,.08);
      margin-bottom: 24px;
      h2 { font-size: 16px; margin-bottom: 16px; }
    }

    .tables-card {
      background: white; border-radius: 12px; padding: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,.08); margin-bottom: 24px;
      h2 { font-size: 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    }
    .tables-legend { display: flex; gap: 8px; margin-left: auto; flex-wrap: wrap; }
    .tleg {
      font-size: 11px; font-weight: 600; padding: 3px 10px;
      border-radius: 20px; text-transform: uppercase; letter-spacing: .04em;
    }
    .tleg--free     { background: #dcfce7; color: #166534; }
    .tleg--occupied { background: #fee2e2; color: #991b1b; }
    .tleg--dirty    { background: #f3e8ff; color: #6b21a8; }
    .tleg--reserved { background: #fef9c3; color: #854d0e; }

    .tables-grid {
      display: flex; flex-wrap: wrap; gap: 8px;
    }
    .table-chip {
      display: flex; flex-direction: column; align-items: center;
      padding: 10px 14px; border-radius: 10px; min-width: 60px;
      border: 2px solid transparent; transition: transform .1s;
      &:hover { transform: scale(1.05); }
    }
    .table-chip__label { font-size: 15px; font-weight: 800; }
    .table-chip__cap   { font-size: 10px; opacity: .7; margin-top: 2px; }
    .table-chip--free     { background: #dcfce7; color: #166534; border-color: #86efac; }
    .table-chip--occupied { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }
    .table-chip--dirty    { background: #f3e8ff; color: #6b21a8; border-color: #d8b4fe; }
    .table-chip--reserved { background: #fef9c3; color: #854d0e; border-color: #fde047; }

    .realtime-feed {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,.08);
      h2 { font-size: 16px; margin-bottom: 12px; display: flex; gap: 8px; align-items: center; }
    }
    .live-dot { color: #ccc; }
    .live-dot--on { color: #4caf50; animation: blink 1s infinite; }
    @keyframes blink { 50% { opacity: 0; } }

    .event-item {
      display: flex;
      gap: 12px;
      padding: 8px 0;
      border-bottom: 1px solid #f0f0f0;
      font-size: 13px;
      align-items: flex-start;
    }
    .event-item--clickable { cursor: pointer; }
    .event-item--clickable:hover { background: #f9fafb; margin: 0 -8px; padding: 8px 8px; border-radius: 6px; }

    .feed-empty    { color: #bbb; font-size: 13px; padding: 8px 0; }
    .event-icon    { font-size: 18px; flex-shrink: 0; margin-top: 1px; }
    .event-body    { flex: 1; min-width: 0; }
    .event-row     { display: flex; align-items: center; gap: 8px; }
    .event-desc    { flex: 1; font-size: 13px; color: #374151; }
    .event-time    { color: #9ca3af; font-size: 12px; white-space: nowrap; }
    .event-chevron { color: #6b7280; font-size: 11px; flex-shrink: 0; }

    .order-lines {
      margin: 6px 0 2px 0;
      padding: 8px 10px;
      background: #f8faff;
      border-left: 3px solid #3f51b5;
      border-radius: 0 6px 6px 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .order-line {
      display: flex;
      gap: 8px;
      font-size: 12px;
      color: #374151;
    }
    .order-line__qty  { font-weight: 700; color: #6b7280; min-width: 24px; }
    .order-line__name { flex: 1; }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  private http    = inject(HttpClient);
  private ws      = inject(WebSocketService);
  private auth    = inject(AuthService);
  private cdr     = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  report      = signal<ProfitabilityReport | null>(null);
  liveEvents  = signal<OrderEvent[]>([]);
  wsConnected = signal(false);
  expandedId  = signal<string | null>(null);
  tables      = signal<TableStatus[]>([]);

  revenueChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{
      data: [],
      label: 'CA TTC (€)',
      backgroundColor: 'rgba(63,81,181,.7)',
      borderColor: '#3f51b5',
      borderRadius: 6,
      borderWidth: 1,
    }]
  };

  chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true } }
  };

  ngOnInit(): void {
    // Rafraîchit toutes les 60s
    interval(60_000).pipe(
      startWith(0),
      switchMap(() => this.http.get<ProfitabilityReport>('/dashboard/today')),
      takeUntil(this.destroy$)
    ).subscribe(r => this.report.set(r));

    // Graphique 30 jours
    this.loadChart();

    // Charge les commandes du jour pour pré-remplir le feed
    this.loadTodayOrders();

    // Charge les tables
    this.loadTables();

    // WebSocket
    this.ws.connect();
    this.ws.connected$.pipe(takeUntil(this.destroy$))
      .subscribe(c => this.wsConnected.set(c));

    const restaurantId = this.auth.getRestaurantId();
    this.ws.dashboardEvents$(restaurantId).pipe(takeUntil(this.destroy$))
      .subscribe(event => {
        this.liveEvents.update(events => [event, ...events].slice(0, 20));
        if (event.eventType === 'ORDER_PAID') {
          this.http.get<ProfitabilityReport>('/dashboard/today')
            .subscribe(r => this.report.set(r));
        }
      });

    this.ws.tablesEvents$(restaurantId).pipe(takeUntil(this.destroy$))
      .subscribe(event => {
        if (event.eventType === 'TABLE_STATUS_CHANGED' && event.tableId && event.tableStatus) {
          this.tables.update(list =>
            list.map(t => t.id === event.tableId
              ? { ...t, status: event.tableStatus as TableStatus['status'] }
              : t)
          );
        }
      });
  }

  private loadTables(): void {
    this.http.get<any[]>('/floor-plans').pipe(
      switchMap(plans => {
        if (!plans.length) return [[]];
        return forkJoin(
          plans.map(p => this.http.get<any[]>(`/floor-plans/${p.id}/tables`))
        );
      })
    ).subscribe(results => {
      const all: TableStatus[] = (results as any[][]).flat().map(t => ({
        id: t.id,
        label: t.label,
        status: t.status,
        capacity: t.capacity ?? 0,
      }));
      this.tables.set(all.sort((a, b) => a.label.localeCompare(b.label, 'fr', { numeric: true })));
    });
  }

  private loadTodayOrders(): void {
    // Commandes actives
    this.http.get<any[]>('/orders').subscribe(orders => {
      const events: OrderEvent[] = orders.map(o => ({
        eventType: 'ORDER_CREATED',
        restaurantId: '',
        orderId: o.orderId,
        tableLabel: o.tableLabel,
        occurredAt: o.confirmedAt,
        lines: (o.lines ?? []).map((l: any) => ({ name: l.productName, quantity: l.quantity }))
      }));
      this.liveEvents.update(prev => {
        const existingIds = new Set(prev.map(e => e.orderId));
        const newEvents = events.filter(e => !existingIds.has(e.orderId));
        return [...prev, ...newEvents].sort((a, b) =>
          new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
        ).slice(0, 20);
      });
    });

  }

  private loadChart(): void {
    this.http.get<{date: string; revenueTtc: number}[]>('/dashboard/daily?days=30')
      .subscribe({
        next: raw => {
          // N'affiche que les jours avec du CA
          const days = raw.filter(d => Number(d.revenueTtc) > 0);
          this.revenueChartData.labels = days.map(d => {
            const [, m, day] = d.date.split('-');
            return `${day}/${m}`;
          });
          this.revenueChartData.datasets[0].data = days.map(d => Number(d.revenueTtc));
          this.chart?.update();
          this.cdr.detectChanges();
        },
        error: err => console.error('Chart load error', err)
      });
  }

  toggleExpand(event: OrderEvent): void {
    if (event.eventType !== 'ORDER_CREATED' || !event.lines?.length) return;
    this.expandedId.set(this.expandedId() === event.occurredAt ? null : event.occurredAt);
  }

  eventIcon(type: string): string {
    return type === 'ORDER_CREATED' ? '🛎️' : '✅';
  }

  eventDesc(event: OrderEvent): string {
    if (event.eventType === 'ORDER_CREATED') {
      return event.tableLabel ? `Nouvelle commande — Table ${event.tableLabel}` : 'Nouvelle commande';
    }
    if (event.eventType === 'ORDER_PAID') {
      return event.tableLabel ? `Commande livrée — Table ${event.tableLabel}` : 'Commande livrée / payée';
    }
    return event.eventType;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.ws.disconnect();
  }
}
