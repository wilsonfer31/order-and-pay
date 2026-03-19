import {
  Component, OnInit,
  ChangeDetectionStrategy, signal, inject
} from '@angular/core';
import { CommonModule }      from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient }        from '@angular/common/http';
import {
  IonContent, IonHeader, IonToolbar, IonTitle,
  IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonList, IonItem, IonLabel, IonIcon, IonFooter, IonNote,
  IonSpinner
} from '@ionic/angular/standalone';
import { addIcons }          from 'ionicons';
import { addCircleOutline, removeCircleOutline, trashOutline, checkmarkOutline } from 'ionicons/icons';
import { CartService }       from '../../services/cart.service';

@Component({
  selector: 'app-order-confirm',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonToolbar, IonTitle,
    IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
    IonList, IonItem, IonLabel, IonIcon, IonFooter, IonNote, IonSpinner
  ],
  template: `
<ion-header>
  <ion-toolbar color="primary">
    <ion-title>Votre panier — {{ cart.tableLabel() }}</ion-title>
  </ion-toolbar>
</ion-header>

<ion-content>

  @if (cart.cartItems().length === 0) {
    <div class="empty-cart">
      <ion-icon name="cart-outline" style="font-size:64px;color:#ccc"></ion-icon>
      <p>Votre panier est vide</p>
      <ion-button (click)="goBack()">Retour au menu</ion-button>
    </div>
  } @else {

    <ion-card class="cart-card">
      <ion-card-header>
        <ion-card-title>Articles commandés</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <ion-list lines="none">
          @for (item of cart.cartItems(); track item.product.id) {
            <ion-item class="cart-item">
              <ion-label>
                <h3>{{ item.product.name }}</h3>
                <ion-note>{{ item.product.priceTtc | currency:'EUR':'symbol':'1.2-2':'fr' }} / unité</ion-note>
              </ion-label>
              <div slot="end" class="qty-controls">
                <ion-button fill="clear" size="small" (click)="remove(item.product.id)">
                  <ion-icon name="remove-circle-outline" color="danger"></ion-icon>
                </ion-button>
                <span class="qty">{{ item.quantity }}</span>
                <ion-button fill="clear" size="small" (click)="add(item.product)">
                  <ion-icon name="add-circle-outline" color="primary"></ion-icon>
                </ion-button>
                <span class="line-total">
                  {{ (item.product.priceTtc * item.quantity) | currency:'EUR':'symbol':'1.2-2':'fr' }}
                </span>
              </div>
            </ion-item>
          }
        </ion-list>

        <div class="total-row">
          <span>Total TTC</span>
          <strong>{{ cart.totalTtc() | currency:'EUR':'symbol':'1.2-2':'fr' }}</strong>
        </div>
      </ion-card-content>
    </ion-card>

    @if (error()) {
      <div class="error-msg">{{ error() }}</div>
    }

  }

</ion-content>

@if (cart.cartItems().length > 0) {
  <ion-footer>
    <ion-toolbar>
      <div class="footer-btns">
        <ion-button fill="outline" color="medium" (click)="goBack()">
          Modifier
        </ion-button>
        <ion-button color="success" [disabled]="submitting()" (click)="placeOrder()">
          @if (submitting()) {
            <ion-spinner name="crescent" slot="start"></ion-spinner>
            Envoi...
          } @else {
            <ion-icon slot="start" name="checkmark-outline"></ion-icon>
            Commander
          }
        </ion-button>
      </div>
    </ion-toolbar>
  </ion-footer>
}
  `,
  styles: [`
    .empty-cart {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; height: 60vh; gap: 16px; color: #888;
    }
    .cart-card { margin: 16px; }
    .cart-item { --padding-start: 0; }
    .qty-controls { display: flex; align-items: center; gap: 4px; }
    .qty { font-weight: 700; font-size: 16px; min-width: 20px; text-align: center; }
    .line-total { font-weight: 600; font-size: 13px; min-width: 60px; text-align: right; color: var(--ion-color-primary); }
    .total-row {
      display: flex; justify-content: space-between;
      border-top: 1px solid #eee; padding-top: 12px; margin-top: 8px;
      font-size: 18px;
    }
    .error-msg {
      color: var(--ion-color-danger); text-align: center;
      padding: 12px 16px; font-size: 14px;
    }
    .footer-btns {
      display: flex; gap: 8px; padding: 8px 16px;
      ion-button { flex: 1; }
    }
  `]
})
export class OrderConfirmPage implements OnInit {
  private route     = inject(ActivatedRoute);
  private router    = inject(Router);
  private http      = inject(HttpClient);
  readonly cart     = inject(CartService);

  submitting = signal(false);
  error      = signal<string | null>(null);

  constructor() {
    addIcons({ addCircleOutline, removeCircleOutline, trashOutline, checkmarkOutline });
  }

  ngOnInit(): void {}

  add(product: any): void    { this.cart.add(product); }
  remove(productId: string): void { this.cart.remove(productId); }

  goBack(): void {
    const t = this.route.snapshot.queryParams['t'];
    this.router.navigate(['/menu'], { queryParams: { t } });
  }

  placeOrder(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);

    const payload = this.cart.toOrderPayload();

    this.http.post<{ orderId: string }>('/public/orders', payload).subscribe({
      next: res => {
        this.cart.clear();
        this.submitting.set(false);
        this.router.navigate(['/track'], { queryParams: { orderId: res.orderId } });
      },
      error: err => {
        this.submitting.set(false);
        const msg = err.error?.message ?? 'Erreur lors de la commande. Réessayez.';
        this.error.set(msg);
      }
    });
  }
}
