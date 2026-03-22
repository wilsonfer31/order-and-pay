import {
  Component, OnInit, ChangeDetectionStrategy, signal, computed, inject
} from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';

interface OrderLine {
  productName: string;
  quantity: number;
  unitPriceHt: number;
}

interface HistoryOrder {
  orderId: string;
  orderNumber: number;
  tableLabel: string;
  status: string;
  source: string;
  totalHt: number;
  totalTtc: number;
  confirmedAt: string | null;
  paidAt: string | null;
  lines: OrderLine[];
}

interface HistoryPage {
  orders: HistoryOrder[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: 'Confirmée', IN_PROGRESS: 'En cours', READY: 'Prête',
  DELIVERED: 'Livrée', PAID: 'Payée', CANCELLED: 'Annulée'
};
const STATUS_COLOR: Record<string, string> = {
  CONFIRMED: '#2563eb', IN_PROGRESS: '#d97706', READY: '#059669',
  DELIVERED: '#7c3aed', PAID: '#16a34a', CANCELLED: '#dc2626'
};

@Component({
  selector: 'app-orders-history',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, CurrencyPipe, DatePipe,
    MatTableModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatChipsModule, MatIconModule,
    MatExpansionModule, MatTooltipModule
  ],
  template: `
<div class="page">

  <div class="page-header">
    <h1 class="page-title">
      <mat-icon>receipt_long</mat-icon>
      Historique des commandes
    </h1>
  </div>

  <!-- Filtres -->
  <div class="filters-bar">
    <mat-form-field appearance="outline" class="filter-field">
      <mat-label>Du</mat-label>
      <input matInput type="date" [(ngModel)]="dateFrom" />
    </mat-form-field>
    <mat-form-field appearance="outline" class="filter-field">
      <mat-label>Au</mat-label>
      <input matInput type="date" [(ngModel)]="dateTo" />
    </mat-form-field>
    <button mat-flat-button color="primary" (click)="load()" [disabled]="loading()">
      <mat-icon>search</mat-icon>
      Rechercher
    </button>
    <button mat-stroked-button (click)="reset()" [disabled]="loading()">
      Réinitialiser
    </button>
    @if (filtered().length > 0) {
      <button mat-stroked-button (click)="exportCsv()" style="margin-left:auto">
        <mat-icon>download</mat-icon>
        Exporter CSV
      </button>
    }
  </div>

  <!-- KPIs résumé -->
  @if (orders().length > 0) {
    <div class="kpis">
      <div class="kpi">
        <span class="kpi__value">{{ total() }}</span>
        <span class="kpi__label">Total commandes</span>
      </div>
      <div class="kpi kpi--highlight">
        <span class="kpi__value">{{ totalTtc() | currency:'EUR':'symbol':'1.2-2':'fr' }}</span>
        <span class="kpi__label">Total TTC</span>
      </div>
      <div class="kpi kpi--green">
        <span class="kpi__value">{{ totalHt() | currency:'EUR':'symbol':'1.2-2':'fr' }}</span>
        <span class="kpi__label">Marge brute (HT)</span>
      </div>
      <div class="kpi">
        <span class="kpi__value">{{ tva() | currency:'EUR':'symbol':'1.2-2':'fr' }}</span>
        <span class="kpi__label">TVA collectée</span>
      </div>
      <div class="kpi">
        <span class="kpi__value">{{ avgTtc() | currency:'EUR':'symbol':'1.2-2':'fr' }}</span>
        <span class="kpi__label">Panier moyen</span>
      </div>
    </div>
  }

  <!-- État vide / chargement -->
  @if (loading()) {
    <div class="state-msg">Chargement…</div>
  } @else if (filtered().length === 0 && !firstLoad()) {
    <div class="state-msg">Aucune commande pour ces critères.</div>
  } @else if (firstLoad()) {
    <div class="state-msg hint">Sélectionnez une plage de dates et cliquez sur Rechercher.</div>
  }

  <!-- Liste -->
  @if (!loading() && filtered().length > 0) {
    <mat-accordion class="orders-list" multi>
      @for (order of filtered(); track order.orderId) {
        <mat-expansion-panel class="order-panel">
          <mat-expansion-panel-header>
            <div class="order-row">
              <span class="order-num">#{{ order.orderNumber }}</span>
              <span class="order-date">{{ order.confirmedAt | date:'dd/MM HH:mm':'':'fr' }}</span>
              <span class="order-status" [style.color]="statusColor(order.status)">
                {{ statusLabel(order.status) }}
              </span>
              <span class="order-total">{{ order.totalTtc | currency:'EUR':'symbol':'1.2-2':'fr' }}</span>
            </div>
          </mat-expansion-panel-header>

          <div class="order-lines">
            @for (line of order.lines; track line.productName) {
              <div class="line-row">
                <span class="line-qty">{{ line.quantity }}×</span>
                <span class="line-name">{{ line.productName }}</span>
              </div>
            }
          </div>
          @if (order.paidAt) {
            <div class="paid-info">
              <mat-icon style="font-size:14px;width:14px;height:14px">payments</mat-icon>
              Payé le {{ order.paidAt | date:'dd/MM/yyyy HH:mm':'':'fr' }}
            </div>
          }
        </mat-expansion-panel>
      }
    </mat-accordion>

    @if (!loading() && total() > pageSize) {
      <div class="pagination">
        <span class="pagination__info">
          {{ firstOnPage }}–{{ lastOnPage }} sur {{ total() }} commandes
        </span>
        <button mat-stroked-button [disabled]="page() === 0" (click)="prevPage()">
          <mat-icon>chevron_left</mat-icon>
        </button>
        <span class="pagination__page">{{ page() + 1 }} / {{ totalPages }}</span>
        <button mat-stroked-button [disabled]="page() + 1 >= totalPages" (click)="nextPage()">
          <mat-icon>chevron_right</mat-icon>
        </button>
      </div>
    }
  }

</div>
  `,
  styles: [`
    .page {
      padding: 24px;
      max-width: 1100px;
      margin: 0 auto;
    }
    .page-header {
      display: flex; align-items: center; margin-bottom: 24px;
    }
    .page-title {
      display: flex; align-items: center; gap: 10px;
      font-size: 22px; font-weight: 700; color: #111827; margin: 0;
      mat-icon { color: #2563eb; }
    }

    .filters-bar {
      display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
      background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
      padding: 16px; margin-bottom: 20px;
    }
    .filter-field { width: 150px; }

    .kpis {
      display: flex; gap: 16px; margin-bottom: 20px;
    }
    .kpi {
      flex: 1; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
      padding: 16px 20px; display: flex; flex-direction: column; gap: 4px;
    }
    .kpi__value { font-size: 22px; font-weight: 700; color: #111827; }
    .kpi__label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: .04em; }
    .kpi--highlight { border-color: #bfdbfe; background: #eff6ff; .kpi__value { color: #1d4ed8; } }
    .kpi--green     { border-color: #bbf7d0; background: #f0fdf4; .kpi__value { color: #15803d; } }

    .state-msg {
      text-align: center; padding: 48px; color: #9ca3af; font-size: 15px;
    }
    .state-msg.hint { color: #d1d5db; }

    .orders-list { display: flex; flex-direction: column; gap: 6px; }

    .order-panel {
      border-radius: 10px !important;
      border: 1px solid #e5e7eb;
      box-shadow: none !important;
    }
    .order-row {
      display: flex; align-items: center; gap: 16px; width: 100%;
      font-size: 14px;
    }
    .order-num  { font-weight: 700; color: #374151; min-width: 50px; }
    .order-date { color: #6b7280; min-width: 100px; }
    .order-status { font-weight: 600; min-width: 80px; }
    .order-total { margin-left: auto; font-weight: 700; color: #111827; font-size: 15px; }

    .order-lines { padding: 8px 0; }
    .line-row {
      display: flex; gap: 10px; padding: 5px 0;
      border-bottom: 1px solid #f3f4f6; font-size: 13px; color: #374151;
      &:last-child { border-bottom: none; }
    }
    .line-qty { font-weight: 700; color: #6b7280; min-width: 28px; }
    .line-name { flex: 1; }

    .paid-info {
      display: flex; align-items: center; gap: 5px;
      font-size: 12px; color: #16a34a; margin-top: 8px; font-weight: 500;
    }

    .pagination {
      display: flex; align-items: center; gap: 12px; justify-content: center;
      margin-top: 20px; padding: 16px;
    }
    .pagination__info { color: #6b7280; font-size: 14px; }
    .pagination__page { font-weight: 600; color: #374151; min-width: 60px; text-align: center; }
  `]
})
export class OrdersHistoryComponent implements OnInit {
  private http = inject(HttpClient);

  orders    = signal<HistoryOrder[]>([]);
  loading   = signal(false);
  firstLoad = signal(true);
  page      = signal(0);
  pageSize  = 50;
  total     = signal(0);

  dateFrom    = '';
  dateTo      = '';
  filtered = computed(() => this.orders());

  totalTtc = computed(() => this.orders().reduce((s, o) => s + o.totalTtc, 0));
  totalHt  = computed(() => this.orders().reduce((s, o) => s + o.totalHt,  0));
  tva      = computed(() => this.totalTtc() - this.totalHt());
  avgTtc   = computed(() => this.orders().length ? this.totalTtc() / this.orders().length : 0);

  get totalPages(): number { return Math.ceil(this.total() / this.pageSize); }
  get firstOnPage(): number { return this.page() * this.pageSize + 1; }
  get lastOnPage(): number { return Math.min((this.page() + 1) * this.pageSize, this.total()); }

  ngOnInit(): void {
    // Initialise les filtres sur "aujourd'hui"
    const today = new Date().toISOString().slice(0, 10);
    this.dateFrom = today;
    this.dateTo   = today;
  }

  load(resetPage = true): void {
    if (resetPage) this.page.set(0);
    this.loading.set(true);
    this.firstLoad.set(false);
    const params: Record<string, string> = {
      page: String(this.page()),
      pageSize: String(this.pageSize),
    };
    if (this.dateFrom) params['from'] = this.dateFrom;
    if (this.dateTo)   params['to']   = this.dateTo;

    this.http.get<HistoryPage>('/orders/history', { params }).subscribe({
      next: data => {
        this.orders.set(data.orders);
        this.total.set(data.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  prevPage(): void { this.page.update(p => p - 1); this.load(false); }
  nextPage(): void { this.page.update(p => p + 1); this.load(false); }

  reset(): void {
    const today = new Date().toISOString().slice(0, 10);
    this.dateFrom = today;
    this.dateTo   = today;
    this.firstLoad.set(true);
    this.orders.set([]);
    this.page.set(0);
    this.total.set(0);
  }

  statusLabel(s: string): string { return STATUS_LABEL[s] ?? s; }
  statusColor(s: string): string { return STATUS_COLOR[s] ?? '#6b7280'; }

  exportCsv(): void {
    const BOM = '\uFEFF';
    const headers = ['Commande', 'Date', 'Statut', 'Total HT', 'Total TTC', 'Articles'];
    const rows = this.filtered().map(o => [
      `#${o.orderNumber}`,
      o.confirmedAt ? new Date(o.confirmedAt).toLocaleString('fr-FR') : '',
      this.statusLabel(o.status),
      o.totalHt.toFixed(2),
      o.totalTtc.toFixed(2),
      o.lines.map(l => `${l.quantity}x ${l.productName}`).join(' | ')
    ]);

    const csv = BOM + [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commandes_${this.dateFrom}_${this.dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
