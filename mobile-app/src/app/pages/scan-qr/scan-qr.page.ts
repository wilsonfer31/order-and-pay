import {
  Component, OnInit, OnDestroy, AfterViewInit,
  ChangeDetectionStrategy, signal, NgZone, inject, ChangeDetectorRef
} from '@angular/core';
import { ViewWillEnter } from '@ionic/angular';
import { CommonModule }     from '@angular/common';
import { Router }           from '@angular/router';
import { FormsModule }      from '@angular/forms';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons,
  IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonSpinner, IonIcon, IonText
} from '@ionic/angular/standalone';
import { addIcons }         from 'ionicons';
import { qrCodeOutline, keypadOutline, cameraOutline, wineOutline } from 'ionicons/icons';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { HttpClient } from '@angular/common/http';
import { TableService, TableInfo } from '../../services/table.service';
import { RxStomp, RxStompState } from '@stomp/rx-stomp';
import { Subject, takeUntil, filter, skip, distinctUntilChanged } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-scan-qr',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons,
    IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
    IonSpinner, IonIcon, IonText
  ],
  template: `
<ion-header>
  <ion-toolbar color="primary">
    <ion-title>Choisir votre table</ion-title>
    <ion-buttons slot="end">
      <ion-button (click)="goToBar()" title="Bar" color="light" [disabled]="!anyTableToken()">
        <ion-icon slot="icon-only" name="wine-outline"></ion-icon>
      </ion-button>
    </ion-buttons>
  </ion-toolbar>
</ion-header>

<ion-content [fullscreen]="true">

  @if (!showScanner()) {

    <!-- Vue grille de tables -->
    <div class="tables-page">

      @if (tablesLoading()) {
        <div class="center-spinner">
          <ion-spinner name="crescent" color="primary"></ion-spinner>
        </div>
      } @else if (tables().length > 0) {
        <p class="tables-hint">Sélectionnez votre table</p>
        <div class="tables-grid">
          @for (table of tables(); track table.id) {
            <button class="table-btn"
                    [class.table-btn--occupied]="table.status === 'OCCUPIED'"
                    [class.table-btn--reserved]="table.status === 'RESERVED'"
                    [class.table-btn--dirty]="table.status === 'DIRTY'"
                    [disabled]="table.status === 'RESERVED'"
                    (click)="selectTable(table)">
              <span class="table-btn__label">{{ table.label }}</span>
              <span class="table-btn__cap">{{ table.capacity }} pers.</span>
              <span class="table-btn__status">{{ statusLabel(table.status) }}</span>
              @if (table.status === 'DIRTY') {
                <button class="table-btn__clean"
                        (click)="$event.stopPropagation(); markClean(table)">
                  ✓ Propre
                </button>
              }
            </button>
          }
        </div>
      }

      <!-- Saisie manuelle fallback -->
      <div class="manual-fallback">
        <p class="manual-fallback__title">Ou saisissez le code manuellement</p>
        <div class="manual-row">
          <input
            class="manual-input"
            [(ngModel)]="manualCode"
            placeholder="Ex: T1, T2…"
            inputmode="text"
            autocomplete="off"
            (keyup.enter)="confirmManual()" />
          <button class="manual-confirm-btn"
                  [disabled]="!manualCode.trim() || loading()"
                  (click)="confirmManual()">
            @if (loading()) { <ion-spinner name="crescent" style="width:18px;height:18px"></ion-spinner> } @else { OK }
          </button>
        </div>
        @if (scanError()) {
          <ion-text color="danger" class="manual-error">{{ scanError() }}</ion-text>
        }
      </div>

      <div class="scanner-toggle">
        <ion-button expand="block" fill="outline" (click)="switchToScanner()">
          <ion-icon slot="start" name="qr-code-outline"></ion-icon>
          Scanner un QR Code
        </ion-button>
      </div>

    </div>

  } @else {

    <!-- Vue scanner QR -->
    <div class="scanner-page">

      <div class="scanner-hint">
        <ion-icon name="qr-code-outline" style="font-size:28px"></ion-icon>
        <span>Pointez la caméra vers le QR Code de votre table</span>
      </div>

      <div class="scanner-frame-wrapper">
        <div id="qr-reader"></div>
        @if (scannerStarting()) {
          <div class="scanner-overlay">
            <ion-spinner name="crescent" color="light"></ion-spinner>
            <p>Activation caméra...</p>
          </div>
        }
      </div>

      @if (scanError()) {
        <ion-card color="danger" class="error-card">
          <ion-card-content>
            <ion-icon name="camera-outline"></ion-icon>
            {{ scanError() }}
          </ion-card-content>
        </ion-card>
      }

      <div class="scanner-actions">
        <ion-button expand="block" fill="outline" color="light" (click)="switchToTableList()">
          <ion-icon slot="start" name="keypad-outline"></ion-icon>
          Choisir une table dans la liste
        </ion-button>
      </div>

    </div>

  }

</ion-content>
  `,
  styles: [`
    /* ── Grille de tables ── */
    .tables-page {
      padding: 16px;
      background: #FFFBF7;
      min-height: 100%;
    }
    .tables-hint {
      font-size: 14px; font-weight: 700; color: #57534E;
      margin: 0 0 14px; text-align: center;
      letter-spacing: .01em;
    }
    .center-spinner {
      display: flex; justify-content: center; padding: 60px;
    }
    .tables-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 24px;
    }
    .table-btn {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 4px; padding: 16px 8px;
      border-radius: 14px; border: 2px solid #E7E5E4;
      background: #fff; cursor: pointer;
      box-shadow: 0 1px 4px rgba(0,0,0,.06);
      transition: border-color .15s, background .15s, transform .1s, box-shadow .15s;
      &:hover:not(:disabled) {
        border-color: #F97316; background: #FFF7ED;
        transform: translateY(-1px); box-shadow: 0 4px 10px rgba(249,115,22,.15);
      }
      &:disabled { opacity: .5; cursor: not-allowed; }
    }
    .table-btn--occupied { background: #FEF2F2; border-color: #FECACA; }
    .table-btn--reserved { background: #FFFBEB; border-color: #FDE68A; }
    .table-btn--dirty    { background: #FAF5FF; border-color: #DDD6FE; }
    .table-btn__clean {
      margin-top: 4px; padding: 3px 10px;
      background: #10B981; color: white;
      border: none; border-radius: 20px;
      font-size: 10px; font-weight: 700; cursor: pointer;
    }
    .table-btn__label { font-size: 22px; font-weight: 800; color: #1C1917; }
    .table-btn__cap   { font-size: 11px; color: #9CA3AF; }
    .table-btn__status {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .05em; color: #78716C;
    }

    /* ── Saisie manuelle ── */
    .manual-fallback {
      border-top: 1px solid #E7E5E4;
      padding-top: 20px; margin-top: 4px;
    }
    .manual-fallback__title {
      font-size: 13px; color: #9CA3AF; margin: 0 0 10px; text-align: center;
    }
    .manual-row { display: flex; gap: 8px; }
    .manual-input {
      flex: 1; padding: 11px 14px; border-radius: 10px;
      border: 1.5px solid #E7E5E4; font-size: 15px; outline: none;
      background: #fff;
      transition: border-color .15s, box-shadow .15s;
      &:focus { border-color: #F97316; box-shadow: 0 0 0 3px rgba(249,115,22,.12); }
    }
    .manual-confirm-btn {
      padding: 11px 20px; border-radius: 10px;
      background: linear-gradient(135deg, #F97316, #EA580C); color: white;
      border: none; font-size: 14px; font-weight: 700; cursor: pointer;
      box-shadow: 0 2px 8px rgba(249,115,22,.3);
      &:disabled { opacity: .5; cursor: not-allowed; box-shadow: none; }
    }
    .manual-error { display: block; padding: 8px 4px; font-size: 13px; }
    .scanner-toggle { margin-top: 20px; }

    /* ── Scanner page ── */
    .scanner-page {
      display: flex; flex-direction: column;
      height: 100%; min-height: calc(100vh - 56px);
      background: #0F172A; color: white; padding: 0;
    }
    .scanner-hint {
      display: flex; align-items: center; gap: 10px;
      padding: 16px 20px; background: rgba(0,0,0,.5);
      font-size: 14px; color: rgba(255,255,255,.80);
    }
    .scanner-frame-wrapper {
      position: relative; flex: 1; min-height: 300px;
      background: #000; display: flex; align-items: center; justify-content: center;
    }
    #qr-reader { width: 100% !important; min-height: 300px; border: none !important; }
    #qr-reader video { width: 100% !important; height: 100% !important; object-fit: cover !important; }
    #qr-reader__dashboard_section_csr button { display: none !important; }
    #qr-reader__dashboard { display: none !important; }
    #qr-reader__header_message { display: none !important; }
    .scanner-overlay {
      position: absolute; inset: 0; background: rgba(0,0,0,.6);
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 12px; color: white; font-size: 14px;
    }
    .error-card { margin: 12px 16px; }
    .scanner-actions { padding: 16px; background: #0F172A; }
  `]
})
export class ScanQrPage implements OnInit, AfterViewInit, OnDestroy, ViewWillEnter {
  private router       = inject(Router);
  private http         = inject(HttpClient);
  private tableService = inject(TableService);
  private ngZone       = inject(NgZone);

  showScanner    = signal(false);
  tables         = signal<TableInfo[]>([]);
  tablesLoading  = signal(true);
  loading        = signal(false);
  scannerStarting = signal(false);
  scanError      = signal<string | null>(null);
  manualCode     = '';

  private scanner: Html5Qrcode | null = null;
  private scannerRunning = false;
  private destroyed = false;
  private stomp = new RxStomp();
  private destroy$ = new Subject<void>();

  constructor() {
    addIcons({ qrCodeOutline, keypadOutline, cameraOutline, wineOutline });
  }

  ngOnInit(): void {
    this.loadTables();
  }

  ionViewWillEnter(): void {
    // Rafraîchit les statuts à chaque retour sur la page (IonRouterOutlet cache les pages)
    this.refreshTables();
  }

  private loadTables(): void {
    this.tableService.listAll().subscribe({
      next: tables => {
        this.tables.set(tables);
        this.tablesLoading.set(false);
        const restaurantId = tables[0]?.restaurantId;
        if (restaurantId) this.connectTableWebSocket(restaurantId);
      },
      error: () => this.tablesLoading.set(false),
    });
  }

  private refreshTables(): void {
    this.tableService.listAll().subscribe({
      next: tables => this.tables.set(tables),
    });
  }

  private connectTableWebSocket(restaurantId: string): void {
    this.stomp.configure({
      brokerURL: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/ws`,
      reconnectDelay: 5000,
    });
    this.stomp.activate();

    this.stomp.watch(`/topic/tables/${restaurantId}`)
      .pipe(
        map(msg => JSON.parse(msg.body)),
        takeUntil(this.destroy$)
      )
      .subscribe(event => {
        if (event.eventType === 'TABLE_STATUS_CHANGED' && event.tableId && event.tableStatus) {
          this.ngZone.run(() => {
            this.tables.update(list =>
              list.map(t => t.id === event.tableId ? { ...t, status: event.tableStatus } : t)
            );
          });
        } else if (event.eventType === 'TABLES_UPDATED') {
          this.ngZone.run(() => this.refreshTables());
        }
      });

    // Rafraîchit les tables à chaque reconnexion WebSocket (rattrape les events manqués)
    this.stomp.connectionState$.pipe(
      distinctUntilChanged(),
      filter(state => state === RxStompState.OPEN),
      skip(1), // ignore la connexion initiale (déjà gérée par loadTables)
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.ngZone.run(() => this.refreshTables());
    });
  }

  ngAfterViewInit(): void {
    // Le scanner n'est pas visible par défaut — rien à initialiser
  }

  statusLabel(status: string): string {
    return { FREE: 'Libre', OCCUPIED: 'Occupée', RESERVED: 'Réservée', DIRTY: 'À nettoyer' }[status] ?? status;
  }

  selectTable(table: TableInfo): void {
    this.navigateToMenu(table.qrToken ?? table.label);
  }

  anyTableToken(): string | null {
    return this.tables().find(t => t.qrToken)?.qrToken ?? null;
  }

  goToBar(): void {
    const token = this.anyTableToken();
    if (token) this.router.navigate(['/bar'], { queryParams: { t: token } });
  }

  markClean(table: TableInfo): void {
    const token = table.qrToken ?? table.label;
    this.http.patch(`/public/tables/${table.id}/clean`, null, { params: { t: token } }).subscribe({
      next: () => this.tables.update(list =>
        list.map(t => t.id === table.id ? { ...t, status: 'FREE' } : t)
      )
    });
  }

  confirmManual(): void {
    if (!this.manualCode.trim()) return;
    this.loading.set(true);
    this.scanError.set(null);
    this.tableService.findByToken(this.manualCode.trim()).subscribe({
      next: table => {
        this.loading.set(false);
        this.navigateToMenu(table.qrToken ?? this.manualCode.trim());
      },
      error: () => {
        this.loading.set(false);
        this.scanError.set('Table introuvable. Vérifiez le code et réessayez.');
      }
    });
  }

  switchToScanner(): void {
    this.scanError.set(null);
    this.showScanner.set(true);
    setTimeout(() => this.initScanner(), 400);
  }

  switchToTableList(): void {
    this.stopScanner();
    this.scanError.set(null);
    this.showScanner.set(false);
  }

  private initScanner(): void {
    if (this.destroyed || !this.showScanner()) return;
    const el = document.getElementById('qr-reader');
    if (!el) { setTimeout(() => this.initScanner(), 200); return; }
    this.startScanner();
  }

  private startScanner(): void {
    this.scannerStarting.set(true);
    this.scanError.set(null);
    try {
      this.scanner = new Html5Qrcode('qr-reader', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
    } catch {
      this.ngZone.run(() => {
        this.scannerStarting.set(false);
        this.scanError.set('Impossible d\'initialiser le scanner.');
      });
      return;
    }

    this.scanner.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: (w, h) => ({ width: Math.min(250, w * 0.8), height: Math.min(250, h * 0.8) }),
        aspectRatio: 1.0,
      },
      (decodedText) => this.ngZone.run(() => this.handleScan(decodedText)),
      () => {}
    )
    .then(() => this.ngZone.run(() => { this.scannerStarting.set(false); this.scannerRunning = true; }))
    .catch((err: Error) => this.ngZone.run(() => {
      this.scannerStarting.set(false);
      const msg = err.message?.toLowerCase() ?? '';
      if (msg.includes('permission') || msg.includes('notallowed')) {
        this.scanError.set('Accès caméra refusé.');
      } else if (msg.includes('notfound') || msg.includes('no camera')) {
        this.scanError.set('Aucune caméra détectée.');
      } else {
        this.scanError.set('Caméra non disponible.');
      }
    }));
  }

  private handleScan(text: string): void {
    const token = this.extractToken(text);
    if (!token) return;
    this.stopScanner();
    this.navigateToMenu(token);
  }

  private extractToken(text: string): string | null {
    try {
      const url = new URL(text);
      return url.searchParams.get('t') ?? url.pathname.split('/').pop() ?? null;
    } catch {
      return text.trim() || null;
    }
  }

  private navigateToMenu(token: string): void {
    this.router.navigate(['/menu'], { queryParams: { t: token } });
  }

  private stopScanner(): void {
    if (!this.scanner) return;
    if (this.scannerRunning) {
      this.scannerRunning = false;
      this.scanner.stop().catch(() => {}).finally(() => { this.scanner?.clear(); this.scanner = null; });
    } else {
      this.scanner.clear();
      this.scanner = null;
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopScanner();
    this.destroy$.next();
    this.destroy$.complete();
    this.stomp.deactivate();
  }
}
