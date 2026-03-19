import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, signal, inject
} from '@angular/core';
import { CommonModule }      from '@angular/common';
import { HttpClient }        from '@angular/common/http';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { Subject, interval, switchMap, takeUntil, startWith } from 'rxjs';

import { WebSocketService, OrderEvent } from '../../core/services/websocket.service';
import { AuthService }                  from '../../core/services/auth.service';

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
            type="line">
    </canvas>
  </div>

  <!-- Flux temps réel -->
  <div class="realtime-feed">
    <h2>Activité en temps réel
      <span class="live-dot" [class.live-dot--on]="wsConnected()">●</span>
    </h2>
    <ul>
      @for (event of liveEvents(); track event.occurredAt) {
        <li class="event-item">
          <span class="event-type">{{ event.eventType }}</span>
          <span class="event-table">{{ event.tableLabel }}</span>
          <span class="event-time">{{ event.occurredAt | date:'HH:mm:ss' }}</span>
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
      align-items: center;
    }
    .event-type  { font-weight: 600; color: #3f51b5; min-width: 180px; }
    .event-table { flex: 1; }
    .event-time  { color: #888; }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  private http    = inject(HttpClient);
  private ws      = inject(WebSocketService);
  private auth    = inject(AuthService);
  private destroy$ = new Subject<void>();

  report      = signal<ProfitabilityReport | null>(null);
  liveEvents  = signal<OrderEvent[]>([]);
  wsConnected = signal(false);

  revenueChartData: ChartData<'line'> = {
    labels: [],
    datasets: [{ data: [], label: 'CA TTC (€)', fill: true, tension: 0.4,
                 borderColor: '#3f51b5', backgroundColor: 'rgba(63,81,181,.1)' }]
  };

  chartOptions: ChartOptions<'line'> = {
    responsive: true,
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

    // WebSocket
    this.ws.connect();
    this.ws.connected$.pipe(takeUntil(this.destroy$))
      .subscribe(c => this.wsConnected.set(c));

    const restaurantId = this.auth.getRestaurantId();
    this.ws.dashboardEvents$(restaurantId).pipe(takeUntil(this.destroy$))
      .subscribe(event => {
        this.liveEvents.update(events => [event, ...events].slice(0, 20));
        // Recharge le rapport à chaque paiement
        if (event.eventType === 'ORDER_PAID') {
          this.http.get<ProfitabilityReport>('/dashboard/today')
            .subscribe(r => this.report.set(r));
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.ws.disconnect();
  }
}
