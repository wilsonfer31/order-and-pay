import {
  Component, OnInit, ChangeDetectionStrategy, signal, computed, inject
} from '@angular/core';
import { CommonModule }      from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonSearchbar,
  IonSegment, IonSegmentButton, IonLabel, IonCard, IonCardContent,
  IonCardHeader, IonCardTitle, IonButton, IonFab,
  IonFabButton, IonIcon, IonChip, IonSpinner, IonFooter
} from '@ionic/angular/standalone';
import { addIcons }          from 'ionicons';
import { cartOutline, addCircleOutline, removeCircleOutline, arrowForwardOutline } from 'ionicons/icons';
import { switchMap }         from 'rxjs';
import { MenuService, Category, Product } from '../../services/menu.service';
import { CartService }                    from '../../services/cart.service';

@Component({
  selector: 'app-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonSearchbar,
    IonSegment, IonSegmentButton, IonLabel, IonCard, IonCardContent,
    IonCardHeader, IonCardTitle, IonButton, IonFab,
    IonFabButton, IonIcon, IonChip, IonSpinner, IonFooter
  ],
  template: `
<ion-header>
  <ion-toolbar color="primary">
    <ion-title>Notre Carte — {{ tableLabel() }}</ion-title>
  </ion-toolbar>
  <ion-toolbar>
    <ion-searchbar
      [value]="searchQuery()"
      (ionInput)="onSearch($event)"
      placeholder="Rechercher un plat..."
      animated>
    </ion-searchbar>
  </ion-toolbar>
  <ion-toolbar>
    <ion-segment [value]="activeCategory()" (ionChange)="onCategoryChange($event)" scrollable>
      @for (cat of categories(); track cat.id) {
        <ion-segment-button [value]="cat.id">
          <ion-label>{{ cat.name }}</ion-label>
        </ion-segment-button>
      }
    </ion-segment>
  </ion-toolbar>
</ion-header>

<ion-content>

  @if (loading()) {
    <div class="center-spinner">
      <ion-spinner name="crescent" color="primary"></ion-spinner>
    </div>
  }

  <!-- Suggestions upselling -->
  @if (upsellProducts().length > 0 && !searchQuery()) {
    <div class="upsell-section">
      <h3>💡 Nos suggestions</h3>
      <div class="upsell-scroll">
        @for (p of upsellProducts(); track p.id) {
          <ion-card class="upsell-card" (click)="addToCart(p)">
            @if (p.imageUrl) {
              <img [src]="p.imageUrl" [alt]="p.name" class="upsell-img" />
            }
            <ion-card-header>
              <ion-card-title>{{ p.name }}</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              {{ p.priceTtc | currency:'EUR':'symbol':'1.2-2':'fr' }}
            </ion-card-content>
          </ion-card>
        }
      </div>
    </div>
  }

  <!-- Liste produits -->
  @for (product of filteredProducts(); track product.id) {
    <ion-card class="product-card">
      <div class="product-card__inner">
        @if (product.imageUrl) {
          <img [src]="product.imageUrl" [alt]="product.name" class="product-img" />
        }
        <div class="product-info">
          <div class="product-name">{{ product.name }}</div>
          @if (product.description) {
            <div class="product-desc">{{ product.description }}</div>
          }
          @if (product.allergens?.length) {
            <div class="allergens">
              @for (a of product.allergens; track a) {
                <ion-chip color="warning" style="font-size:11px">{{ a }}</ion-chip>
              }
            </div>
          }
          <div class="product-footer">
            <span class="product-price">{{ product.priceTtc | currency:'EUR':'symbol':'1.2-2':'fr' }}</span>
            <div class="qty-controls">
              @if (getQty(product.id) > 0) {
                <ion-button fill="clear" size="small" (click)="removeFromCart(product)">
                  <ion-icon name="remove-circle-outline" color="danger"></ion-icon>
                </ion-button>
                <span class="qty-badge">{{ getQty(product.id) }}</span>
              }
              <ion-button fill="clear" size="small" (click)="addToCart(product)"
                          [disabled]="!product.available">
                <ion-icon name="add-circle-outline" color="primary"></ion-icon>
              </ion-button>
            </div>
          </div>
        </div>
      </div>
    </ion-card>
  }

</ion-content>

@if (cart.totalItems() > 0) {
  <ion-footer>
    <ion-toolbar>
      <ion-button expand="block" color="primary" (click)="goToCart()">
        <ion-icon slot="start" name="cart-outline"></ion-icon>
        Voir le panier ({{ cart.totalItems() }} art.) —
        {{ cart.totalTtc() | currency:'EUR':'symbol':'1.2-2':'fr' }}
        <ion-icon slot="end" name="arrow-forward-outline"></ion-icon>
      </ion-button>
    </ion-toolbar>
  </ion-footer>
}
  `,
  styles: [`
    .center-spinner { display: flex; justify-content: center; padding: 60px; }
    .upsell-section { padding: 16px; }
    .upsell-section h3 { font-size: 16px; font-weight: 700; margin-bottom: 12px; }
    .upsell-scroll { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; }
    .upsell-card { min-width: 140px; max-width: 140px; margin: 0; cursor: pointer; }
    .upsell-img  { width: 100%; height: 90px; object-fit: cover; }
    .product-card { margin: 8px 16px; }
    .product-card__inner { display: flex; gap: 12px; }
    .product-img  { width: 80px; height: 80px; object-fit: cover; border-radius: 8px; flex-shrink: 0; }
    .product-info { flex: 1; padding: 12px 12px 12px 0; }
    .product-name { font-weight: 700; font-size: 15px; }
    .product-desc { font-size: 12px; color: #666; margin-top: 4px; }
    .allergens    { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
    .product-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
    .product-price { font-size: 16px; font-weight: 800; color: var(--ion-color-primary); }
    .qty-controls  { display: flex; align-items: center; gap: 4px; }
    .qty-badge     { font-weight: 700; font-size: 16px; min-width: 20px; text-align: center; }
  `]
})
export class MenuPage implements OnInit {
  private route        = inject(ActivatedRoute);
  private router       = inject(Router);
  private menuService  = inject(MenuService);
  readonly cart        = inject(CartService);

  categories      = signal<Category[]>([]);
  allProducts     = signal<Product[]>([]);
  loading         = signal(true);
  tableToken      = signal('');
  tableLabel      = signal('');
  searchQuery     = signal('');
  activeCategory  = signal('');

  upsellProducts = computed(() =>
    this.allProducts().filter(p => p.upsell && p.available).slice(0, 5)
  );

  filteredProducts = computed(() => {
    let products = this.allProducts();
    if (this.activeCategory()) {
      products = products.filter(p => p.categoryId === this.activeCategory());
    }
    const q = this.searchQuery().toLowerCase();
    if (q) {
      products = products.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      );
    }
    return products;
  });

  constructor() {
    addIcons({ cartOutline, addCircleOutline, removeCircleOutline, arrowForwardOutline });
  }

  ngOnInit(): void {
    this.route.queryParams.pipe(
      switchMap(params => {
        this.tableToken.set(params['t'] ?? '');
        return this.menuService.getMenuByToken(params['t']);
      })
    ).subscribe(menu => {
      this.categories.set(menu.categories);
      this.allProducts.set(menu.products);
      this.tableLabel.set(menu.tableLabel);
      this.cart.initTable(menu.tableId, menu.tableLabel);
      if (menu.categories.length > 0) {
        this.activeCategory.set(menu.categories[0].id);
      }
      this.loading.set(false);
    });
  }

  onSearch(event: any): void {
    this.searchQuery.set(event.detail.value ?? '');
  }

  onCategoryChange(event: any): void {
    this.activeCategory.set(event.detail.value ?? '');
  }

  addToCart(product: Product): void     { this.cart.add(product); }
  removeFromCart(product: Product): void { this.cart.remove(product.id); }
  getQty(productId: string): number     { return this.cart.getQty(productId); }

  goToCart(): void {
    this.router.navigate(['/order-confirm'], { queryParams: { t: this.tableToken() } });
  }
}
