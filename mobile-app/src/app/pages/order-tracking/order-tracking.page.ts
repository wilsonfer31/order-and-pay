import {
  Component, OnInit, OnDestroy,
  ChangeDetectionStrategy, signal, inject
} from '@angular/core';
import { CommonModule }      from '@angular/common';
import { ActivatedRoute, Router }    from '@angular/router';
import { HttpClient }        from '@angular/common/http';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonProgressBar, IonChip, IonLabel, IonCard, IonCardContent,
  IonIcon, IonList, IonItem, AlertController
} from '@ionic/angular/standalone';
import { addIcons }          from 'ionicons';
import { checkmarkCircle, time, timeOutline, restaurant, bicycle, homeOutline, closeCircle, alertCircle } from 'ionicons/icons';
import { RxStomp, RxStompState } from '@stomp/rx-stomp';
import { Subject, takeUntil } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';

export type OrderStatus = 'CONFIRMED' | 'IN_PROGRESS' | 'READY' | 'DELIVERED' | 'CANCELLED';

export interface OrderLine {
  id: string;
  productName: string;
  quantity: number;
  status: 'PENDING' | 'COOKING' | 'READY' | 'SERVED';
}

export interface OrderState {
  orderId: string;
  tableLabel: string;
  status: OrderStatus;
  lines: OrderLine[];
  totalTtc: number;
  confirmedAt?: string | null;
  estimatedMinutes?: number;
}

const STATUS_STEPS: OrderStatus[] = ['CONFIRMED', 'IN_PROGRESS', 'READY', 'DELIVERED'];

@Component({
  selector: 'app-order-tracking',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
    IonProgressBar, IonChip, IonLabel, IonCard, IonCardContent,
    IonIcon, IonList, IonItem
  ],
  template: `
<ion-header>
  <ion-toolbar color="primary">
    <ion-title>Votre commande</ion-title>
    <ion-buttons slot="end" style="z-index:100;position:relative">
      <ion-button (click)="goHome()" style="--color:#fff;font-size:13px;font-weight:600">
        <ion-icon slot="start" name="home-outline"></ion-icon>
        Accueil
      </ion-button>
    </ion-buttons>
  </ion-toolbar>
</ion-header>

<ion-content class="ion-padding">

  @if (wsState() !== 'connected') {
    <div class="ws-banner" [class.ws-banner--error]="wsState() === 'disconnected'">
      <ion-icon name="alert-circle" style="font-size:18px;flex-shrink:0"></ion-icon>
      @if (wsState() === 'reconnecting') {
        Reconnexion en cours…
      } @else {
        Connexion perdue — les mises à jour en temps réel sont indisponibles.
      }
    </div>
  }

  @if (order()?.status === 'CANCELLED') {
    <div class="cancelled-banner">
      <ion-icon name="close-circle" style="font-size:48px;color:#ef4444"></ion-icon>
      <h2>Commande annulée</h2>
      <p>Cette commande a été annulée.</p>
      <ion-button expand="block" color="primary" (click)="goHome()">Retour à l'accueil</ion-button>
    </div>
  }

  @if (order() && order()?.status !== 'CANCELLED') {
    <!-- Barre de progression -->
    <div class="status-steps">
      @for (step of steps; track step; let i = $index) {
        <div class="step" [class.step--active]="stepIndex() >= i"
                          [class.step--done]="stepIndex() > i">
          <div class="step__icon">
            <ion-icon [name]="stepIcon(step)"></ion-icon>
          </div>
          <div class="step__label">{{ stepLabel(step) }}</div>
        </div>
        @if (i < steps.length - 1) {
          <div class="step__connector" [class.step__connector--done]="stepIndex() > i"></div>
        }
      }
    </div>

    <ion-progress-bar
      [value]="stepIndex() / (steps.length - 1)"
      color="primary"
      style="margin-bottom: 24px; border-radius: 8px">
    </ion-progress-bar>

    <!-- Heure de prise de commande -->
    @if (order()?.confirmedAt) {
      <div class="order-time">
        <ion-icon name="time-outline" style="font-size:16px;flex-shrink:0"></ion-icon>
        Commande prise à <strong>{{ formatTime(order()!.confirmedAt!) }}</strong>
      </div>
    }

    <!-- Message contextuel -->
    <div class="status-message">
      {{ statusMessage() }}
    </div>

    <!-- Détail des lignes -->
    <ion-card>
      <ion-card-content>
        <h2>Récapitulatif</h2>
        <ion-list lines="none">
          @for (line of order()!.lines; track line.id) {
            <ion-item>
              <ion-icon slot="start"
                [name]="lineIcon(line.status)"
                [color]="lineColor(line.status)">
              </ion-icon>
              <ion-label>
                <b>{{ line.quantity }}x</b> {{ line.productName }}
              </ion-label>
              <ion-chip slot="end" [color]="lineColor(line.status)" outline>
                {{ lineLabel(line.status) }}
              </ion-chip>
            </ion-item>
          }
        </ion-list>
        <div class="total-row">
          <span>Total</span>
          <strong>{{ order()!.totalTtc | currency:'EUR':'symbol':'1.2-2':'fr' }}</strong>
        </div>
      </ion-card-content>
    </ion-card>

    <!-- Bouton annulation (serveur peut annuler si pas encore livré) -->
    @if (order()?.status === 'CONFIRMED' || order()?.status === 'IN_PROGRESS') {
      <ion-button expand="block" fill="outline" color="danger"
                  style="margin-top: 16px"
                  (click)="confirmCancel()">
        <ion-icon slot="start" name="close-circle"></ion-icon>
        Annuler ma commande
      </ion-button>
    }
  }

</ion-content>
  `,
  styles: [`
    .status-steps {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 24px 0 16px;
    }
    .step {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .step__icon {
      width: 44px; height: 44px;
      border-radius: 50%;
      background: #E7E5E4;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px;
      transition: background .3s, box-shadow .3s;
    }
    .step--active .step__icon {
      background: #F97316; color: white;
      box-shadow: 0 3px 10px rgba(249,115,22,.35);
    }
    .step--done .step__icon {
      background: #10B981; color: white;
      box-shadow: 0 3px 8px rgba(16,185,129,.25);
    }
    .step__label { font-size: 10px; color: #9CA3AF; text-align: center; max-width: 60px; font-weight: 600; }
    .step--active .step__label { color: #F97316; }
    .step--done   .step__label { color: #10B981; }
    .step__connector { flex: 1; height: 3px; background: #E7E5E4; transition: background .3s; margin: 0 4px; }
    .step__connector--done { background: #10B981; }

    .order-time {
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; color: #78716C;
      background: #F5F5F4; border-radius: 10px;
      padding: 10px 14px; margin-bottom: 12px;
      strong { color: #1C1917; }
    }
    .status-message {
      font-size: 15px;
      font-weight: 600;
      padding: 14px 18px;
      background: #FFF7ED;
      border-left: 4px solid #F97316;
      border-radius: 0 12px 12px 0;
      margin-bottom: 20px;
      color: #1C1917;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 12px;
      border-top: 1px solid #F5F5F4;
      font-size: 16px;
      strong { color: #F97316; font-size: 18px; }
    }

    .ws-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      padding: 10px 14px;
      border-radius: 10px;
      margin-bottom: 12px;
      background: #FEF3C7;
      color: #92400E;
      ion-icon { color: #D97706; }
    }
    .ws-banner--error {
      background: #FEE2E2;
      color: #991B1B;
      ion-icon { color: #DC2626; }
    }

    .cancelled-banner {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 48px 24px;
      gap: 12px;
      h2 { font-size: 22px; font-weight: 700; color: #ef4444; margin: 0; }
      p  { color: #78716C; margin: 0; }
    }
  `]
})
export class OrderTrackingPage implements OnInit, OnDestroy {
  private route   = inject(ActivatedRoute);
  private router  = inject(Router);
  private http    = inject(HttpClient);
  private alertCtrl = inject(AlertController);
  private destroy$ = new Subject<void>();
  private stomp   = new RxStomp();

  order      = signal<OrderState | null>(null);
  loadError  = signal(false);
  wsState    = signal<'connected' | 'reconnecting' | 'disconnected'>('reconnecting');
  steps      = STATUS_STEPS;
  tableToken = signal('');

  stepIndex = () => {
    const o = this.order();
    if (!o) return 0;
    return STATUS_STEPS.indexOf(o.status);
  };

  cancelInFlight = signal(false);

  constructor() {
    addIcons({ checkmarkCircle, time, timeOutline, restaurant, bicycle, homeOutline, closeCircle, alertCircle });
  }

  ngOnInit(): void {
    const orderId = this.route.snapshot.queryParams['orderId'];
    const t = this.route.snapshot.queryParams['t'] ?? '';
    this.tableToken.set(t);
    if (!orderId) return;

    // Chargement initial de l'état depuis le backend
    this.http.get<OrderState>(`/public/orders/${orderId}`).subscribe({
      next: state => {
        this.order.set(state);
        this.connectWebSocket(orderId);
      },
      error: () => {
        this.loadError.set(true);
        // Tente quand même le WebSocket pour capter les événements en direct
        this.connectWebSocket(orderId);
      }
    });
  }

  private connectWebSocket(orderId: string): void {
    this.stomp.configure({
      brokerURL: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/ws`,
      reconnectDelay: 5000,
    });
    this.stomp.activate();

    // Track connection state for the visual indicator
    this.stomp.connectionState$
      .pipe(distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(state => {
        if (state === RxStompState.OPEN) {
          this.wsState.set('connected');
        } else if (state === RxStompState.CLOSING || state === RxStompState.CLOSED) {
          // CLOSED triggers a reconnect attempt — show 'reconnecting' not 'disconnected'
          // unless stomp is explicitly deactivated (destroy path)
          this.wsState.set('reconnecting');
        }
      });

    this.stomp
      .watch(`/topic/client/${orderId}`)
      .pipe(
        map(msg => JSON.parse(msg.body)),
        takeUntil(this.destroy$)
      )
      .subscribe(event => this.applyEvent(event));
  }

  private applyEvent(event: any): void {
    switch (event.eventType) {
      case 'ORDER_STATUS_CHANGED':
        this.order.update(o => o
          ? { ...o, status: event.orderStatus }
          : { orderId: event.orderId, tableLabel: '', status: event.orderStatus, lines: [], totalTtc: 0 }
        );
        if (event.orderStatus === 'CANCELLED') {
          this.stomp.deactivate();
        }
        break;
      case 'LINE_STATUS_CHANGED':
        this.order.update(o => o ? {
          ...o,
          lines: o.lines.map(l =>
            l.id === event.lineId ? { ...l, status: event.lineStatus } : l
          )
        } : o);
        break;
    }
  }

  async confirmCancel(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Annuler la commande',
      message: 'Cette action est irréversible. Voulez-vous vraiment annuler votre commande ?',
      buttons: [
        { text: 'Non', role: 'cancel' },
        { text: 'Oui, annuler', role: 'confirm', cssClass: 'alert-button-danger' }
      ]
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'confirm') return;
    const orderId = this.order()?.orderId;
    if (!orderId || this.cancelInFlight()) return;
    this.cancelInFlight.set(true);
    this.http.delete(`/public/orders/${orderId}`, { params: { t: this.tableToken() } }).subscribe({
      next: () => {
        this.order.update(o => o ? { ...o, status: 'CANCELLED' } : o);
        this.stomp.deactivate();
        this.cancelInFlight.set(false);
      },
      error: (err) => {
        const msg = err?.error?.error ?? 'Impossible d\'annuler cette commande.';
        this.alertCtrl.create({ header: 'Erreur', message: msg, buttons: ['OK'] })
          .then(a => a.present());
        this.cancelInFlight.set(false);
      }
    });
  }

  goHome(): void {
    this.router.navigate(['/scan']);
  }

  formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  statusMessage(): string {
    switch (this.order()?.status) {
      case 'CONFIRMED':   return 'Votre commande est confirmée ✅';
      case 'IN_PROGRESS': return 'La cuisine prépare vos plats... 👨‍🍳';
      case 'READY':       return 'C\'est prêt ! Votre serveur arrive 🍽️';
      case 'DELIVERED':   return 'Bon appétit ! 🎉';
      case 'CANCELLED':   return 'Commande annulée.';
      default:            return '';
    }
  }

  stepIcon(step: OrderStatus): string {
    return ({ CONFIRMED: 'checkmark-circle', IN_PROGRESS: 'time',
              READY: 'restaurant', DELIVERED: 'bicycle', CANCELLED: 'close-circle' } as Record<string, string>)[step] ?? 'time';
  }

  stepLabel(step: OrderStatus): string {
    return ({ CONFIRMED: 'Confirmée', IN_PROGRESS: 'En cours',
              READY: 'Prête', DELIVERED: 'Servie', CANCELLED: 'Annulée' } as Record<string, string>)[step] ?? step;
  }

  lineIcon(status: string): string {
    return { PENDING: 'time', COOKING: 'restaurant', READY: 'checkmark-circle',
             SERVED: 'bicycle', CANCELLED: 'close-circle' }[status] ?? 'time';
  }

  lineColor(status: string): string {
    return { PENDING: 'medium', COOKING: 'warning', READY: 'success',
             SERVED: 'primary', CANCELLED: 'danger' }[status] ?? 'medium';
  }

  lineLabel(status: string): string {
    return { PENDING: 'En attente', COOKING: 'En cuisine', READY: 'Prêt',
             SERVED: 'Servi', CANCELLED: 'Annulé' }[status] ?? status;
  }

  ngOnDestroy(): void {
    this.wsState.set('disconnected');
    this.destroy$.next();
    this.destroy$.complete();
    this.stomp.deactivate();
  }
}
