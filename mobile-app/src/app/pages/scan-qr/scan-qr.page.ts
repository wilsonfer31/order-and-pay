import {
  Component, OnDestroy, AfterViewInit,
  ChangeDetectionStrategy, signal, NgZone, inject
} from '@angular/core';
import { CommonModule }     from '@angular/common';
import { Router }           from '@angular/router';
import { FormsModule }      from '@angular/forms';
import {
  IonContent, IonHeader, IonToolbar, IonTitle,
  IonButton, IonItem, IonInput, IonLabel, IonNote,
  IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonSpinner, IonIcon, IonText, IonFooter
} from '@ionic/angular/standalone';
import { addIcons }         from 'ionicons';
import { qrCodeOutline, keypadOutline, cameraOutline, refreshOutline } from 'ionicons/icons';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { TableService }     from '../../services/table.service';

@Component({
  selector: 'app-scan-qr',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonToolbar, IonTitle,
    IonButton, IonItem, IonInput, IonLabel, IonNote,
    IonCard, IonCardContent, IonCardHeader, IonCardTitle,
    IonSpinner, IonIcon, IonText, IonFooter
  ],
  template: `
<ion-header>
  <ion-toolbar color="primary">
    <ion-title>Scanner votre table</ion-title>
  </ion-toolbar>
</ion-header>

<ion-content [fullscreen]="true">

  @if (!showManual()) {

    <!-- Vue scanner -->
    <div class="scanner-page">

      <div class="scanner-hint">
        <ion-icon name="qr-code-outline" style="font-size:28px"></ion-icon>
        <span>Pointez la caméra vers le QR Code de votre table</span>
      </div>

      <!-- Conteneur du scanner — doit être dans le DOM avant l'init -->
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
        <ion-button expand="block" fill="outline" color="light"
                    (click)="switchToManual()">
          <ion-icon slot="start" name="keypad-outline"></ion-icon>
          Saisir le numéro manuellement
        </ion-button>
      </div>

    </div>

  } @else {

    <!-- Vue saisie manuelle -->
    <div class="manual-page">
      <ion-card class="manual-card">
        <ion-card-header>
          <ion-card-title>Numéro de table</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-item lines="full">
            <ion-label position="stacked">Code ou numéro de table</ion-label>
            <ion-input
              [(ngModel)]="manualCode"
              placeholder="Ex: T1, T2, T3..."
              inputmode="text"
              autocomplete="off"
              clearInput="true"
              (keyup.enter)="confirmManual()">
            </ion-input>
          </ion-item>

          @if (scanError()) {
            <ion-text color="danger" class="manual-error">{{ scanError() }}</ion-text>
          }

          <ion-button expand="block" class="confirm-btn"
                      (click)="confirmManual()"
                      [disabled]="!manualCode.trim() || loading()">
            @if (loading()) {
              <ion-spinner name="crescent" slot="start"></ion-spinner>
              Vérification...
            } @else {
              Confirmer
            }
          </ion-button>

          <ion-button expand="block" fill="clear" (click)="switchToScanner()">
            <ion-icon slot="start" name="qr-code-outline"></ion-icon>
            Scanner un QR Code
          </ion-button>
        </ion-card-content>
      </ion-card>
    </div>

  }

</ion-content>
  `,
  styles: [`
    /* Scanner page — plein écran */
    .scanner-page {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: calc(100vh - 56px);
      background: #111;
      color: white;
      padding: 0;
    }

    .scanner-hint {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 16px 20px;
      background: rgba(0,0,0,.4);
      font-size: 14px;
      color: rgba(255,255,255,.85);
    }

    .scanner-frame-wrapper {
      position: relative;
      flex: 1;
      min-height: 300px;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Force html5-qrcode à remplir son conteneur */
    #qr-reader {
      width: 100% !important;
      min-height: 300px;
      border: none !important;
    }
    #qr-reader video {
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
    }
    /* Masquer les boutons internes de html5-qrcode */
    #qr-reader__dashboard_section_csr button { display: none !important; }
    #qr-reader__dashboard { display: none !important; }
    #qr-reader__header_message { display: none !important; }

    .scanner-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,.6);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: white;
      font-size: 14px;
    }

    .error-card {
      margin: 12px 16px;
      ion-card-content {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
      }
    }

    .scanner-actions {
      padding: 16px;
      background: #111;
    }

    /* Manuel page */
    .manual-page {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: calc(100vh - 56px);
      padding: 24px 16px;
      background: #f5f5f5;
    }
    .manual-card { width: 100%; max-width: 400px; }
    .manual-error { display: block; padding: 8px 4px; font-size: 13px; }
    .confirm-btn  { margin: 16px 0 8px; }
  `]
})
export class ScanQrPage implements AfterViewInit, OnDestroy {
  private router       = inject(Router);
  private tableService = inject(TableService);
  private ngZone       = inject(NgZone);

  showManual     = signal(false);
  loading        = signal(false);
  scannerStarting = signal(false);
  scanError      = signal<string | null>(null);
  manualCode     = '';

  private scanner: Html5Qrcode | null = null;
  private scannerRunning = false;
  private destroyed = false;

  constructor() {
    addIcons({ qrCodeOutline, keypadOutline, cameraOutline, refreshOutline });
  }

  ngAfterViewInit(): void {
    // Laisser Ionic finir le rendu avant d'accéder au DOM
    setTimeout(() => this.initScanner(), 300);
  }

  private initScanner(): void {
    if (this.destroyed || this.showManual()) return;
    const el = document.getElementById('qr-reader');
    if (!el) {
      // Réessayer si le DOM n'est pas encore prêt
      setTimeout(() => this.initScanner(), 200);
      return;
    }
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
    } catch (e) {
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
      (decodedText) => {
        this.ngZone.run(() => this.handleScan(decodedText));
      },
      () => { /* erreurs de détection silencieuses */ }
    )
    .then(() => {
      this.ngZone.run(() => {
        this.scannerStarting.set(false);
        this.scannerRunning = true;
      });
    })
    .catch((err: Error) => {
      this.ngZone.run(() => {
        this.scannerStarting.set(false);
        const msg = err.message?.toLowerCase() ?? '';
        if (msg.includes('permission') || msg.includes('notallowed')) {
          this.scanError.set('Accès caméra refusé. Autorisez la caméra dans votre navigateur puis rechargez.');
        } else if (msg.includes('notfound') || msg.includes('no camera')) {
          this.scanError.set('Aucune caméra détectée sur cet appareil.');
        } else {
          this.scanError.set('Caméra non disponible. Utilisez la saisie manuelle.');
        }
      });
    });
  }

  /** Extrait le token depuis une URL QR ou un texte brut. */
  private extractToken(text: string): string | null {
    try {
      const url = new URL(text);
      return url.searchParams.get('t') ?? url.pathname.split('/').pop() ?? null;
    } catch {
      return text.trim() || null;
    }
  }

  private handleScan(text: string): void {
    const token = this.extractToken(text);
    if (!token) return;
    this.stopScanner();
    this.navigateToMenu(token);
  }

  switchToManual(): void {
    this.stopScanner();
    this.scanError.set(null);
    this.showManual.set(true);
  }

  switchToScanner(): void {
    this.scanError.set(null);
    this.showManual.set(false);
    // Réinitialiser après que @if re-rende le #qr-reader
    setTimeout(() => this.initScanner(), 400);
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

  private navigateToMenu(token: string): void {
    this.router.navigate(['/menu'], { queryParams: { t: token } });
  }

  private stopScanner(): void {
    if (!this.scanner) return;
    if (this.scannerRunning) {
      this.scannerRunning = false;
      this.scanner.stop().catch(() => {}).finally(() => {
        this.scanner?.clear();
        this.scanner = null;
      });
    } else {
      this.scanner.clear();
      this.scanner = null;
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopScanner();
  }
}
