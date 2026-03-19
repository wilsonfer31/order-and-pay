import {
  Component, OnInit, OnDestroy,
  ChangeDetectionStrategy, signal, inject
} from '@angular/core';
import { CommonModule }      from '@angular/common';
import { ActivatedRoute }    from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle,
  IonProgressBar, IonChip, IonLabel, IonCard, IonCardContent,
  IonIcon, IonList, IonItem
} from '@ionic/angular/standalone';
import { addIcons }          from 'ionicons';
import { checkmarkCircle, time, restaurant, bicycle } from 'ionicons/icons';
import { RxStomp }           from '@stomp/rx-stomp';
import { Subject, takeUntil } from 'rxjs';
import { map } from 'rxjs/operators';

export type OrderStatus = 'CONFIRMED' | 'IN_PROGRESS' | 'READY' | 'DELIVERED';

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
  estimatedMinutes?: number;
}

const STATUS_STEPS: OrderStatus[] = ['CONFIRMED', 'IN_PROGRESS', 'READY', 'DELIVERED'];

@Component({
  selector: 'app-order-tracking',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonToolbar, IonTitle,
    IonProgressBar, IonChip, IonLabel, IonCard, IonCardContent,
    IonIcon, IonList, IonItem
  ],
  template: `
<ion-header>
  <ion-toolbar color="primary">
    <ion-title>Votre commande</ion-title>
  </ion-toolbar>
</ion-header>

<ion-content class="ion-padding">

  @if (order()) {
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
      width: 40px; height: 40px;
      border-radius: 50%;
      background: #e0e0e0;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px;
      transition: background .3s;
    }
    .step--active .step__icon { background: var(--ion-color-primary); color: white; }
    .step--done   .step__icon { background: #4caf50; color: white; }
    .step__label  { font-size: 10px; color: #888; text-align: center; max-width: 60px; }
    .step__connector { flex: 1; height: 3px; background: #e0e0e0; transition: background .3s; }
    .step__connector--done { background: #4caf50; }

    .status-message {
      text-align: center;
      font-size: 16px;
      font-weight: 600;
      padding: 16px;
      background: #f5f5f5;
      border-radius: 12px;
      margin-bottom: 20px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding-top: 12px;
      border-top: 1px solid #eee;
      font-size: 16px;
    }
  `]
})
export class OrderTrackingPage implements OnInit, OnDestroy {
  private route   = inject(ActivatedRoute);
  private destroy$ = new Subject<void>();
  private stomp   = new RxStomp();

  order      = signal<OrderState | null>(null);
  steps      = STATUS_STEPS;

  stepIndex = () => {
    const o = this.order();
    if (!o) return 0;
    return STATUS_STEPS.indexOf(o.status);
  };

  constructor() {
    addIcons({ checkmarkCircle, time, restaurant, bicycle });
  }

  ngOnInit(): void {
    const orderId = this.route.snapshot.queryParams['orderId'];
    if (!orderId) return;

    // Chargement initial de l'état
    // (dans un vrai projet, HTTP GET /public/orders/:id)

    // Connexion WebSocket pour les mises à jour temps réel
    this.stomp.configure({
      brokerURL: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/ws/websocket`,
      reconnectDelay: 5000,
    });
    this.stomp.activate();

    this.stomp
      .watch(`/topic/client/${orderId}`)
      .pipe(
        map(msg => JSON.parse(msg.body)),
        takeUntil(this.destroy$)
      )
      .subscribe(event => this.applyEvent(event));
  }

  private applyEvent(event: any): void {
    if (!this.order()) return;
    switch (event.eventType) {
      case 'ORDER_STATUS_CHANGED':
        this.order.update(o => o ? { ...o, status: event.orderStatus } : o);
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

  statusMessage(): string {
    switch (this.order()?.status) {
      case 'CONFIRMED':   return 'Votre commande est confirmée ✅';
      case 'IN_PROGRESS': return 'La cuisine prépare vos plats... 👨‍🍳';
      case 'READY':       return 'C\'est prêt ! Votre serveur arrive 🍽️';
      case 'DELIVERED':   return 'Bon appétit ! 🎉';
      default:            return '';
    }
  }

  stepIcon(step: OrderStatus): string {
    return { CONFIRMED: 'checkmark-circle', IN_PROGRESS: 'time',
             READY: 'restaurant', DELIVERED: 'bicycle' }[step];
  }

  stepLabel(step: OrderStatus): string {
    return { CONFIRMED: 'Confirmée', IN_PROGRESS: 'En cours',
             READY: 'Prête', DELIVERED: 'Servie' }[step];
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
    this.destroy$.next();
    this.destroy$.complete();
    this.stomp.deactivate();
  }
}
