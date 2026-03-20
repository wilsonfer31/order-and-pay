import {
  Component, OnInit, ChangeDetectionStrategy, signal, computed, inject, DestroyRef
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule }      from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient }        from '@angular/common/http';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonCard, IonCardContent,
  IonCardHeader, IonCardTitle, IonButton, IonFab,
  IonFabButton, IonIcon, IonChip, IonSpinner, IonFooter
} from '@ionic/angular/standalone';
import { addIcons }          from 'ionicons';
import { cartOutline, addCircleOutline, removeCircleOutline, arrowForwardOutline, listOutline, chevronBackOutline, cameraOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { FormsModule }       from '@angular/forms';
import { switchMap }         from 'rxjs';
import { MenuService, Category, Product } from '../../services/menu.service';
import { CartService }                    from '../../services/cart.service';

@Component({
  selector: 'app-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonCard, IonCardContent,
    IonCardHeader, IonCardTitle, IonButton, IonFab,
    IonFabButton, IonIcon, IonChip, IonSpinner, IonFooter
  ],
  template: `
<ion-header>
  <ion-toolbar color="primary">
    <ion-buttons slot="start">
      <ion-back-button defaultHref="/scan" text="Tables"></ion-back-button>
    </ion-buttons>
    <ion-title>Notre Carte — {{ tableLabel() }}</ion-title>
  </ion-toolbar>
  <ion-toolbar>
    <div class="search-wrapper">
      <input
        class="native-search"
        type="search"
        [ngModel]="searchQuery()"
        (ngModelChange)="searchQuery.set($event)"
        placeholder="🔍 Rechercher un plat..." />
    </div>
  </ion-toolbar>
  <div class="cat-tabs">
    <button class="cat-tab" [class.active]="!activeCategory()"
            (click)="activeCategory.set('')">
      Tous
    </button>
    @for (cat of categories(); track cat.id) {
      <button class="cat-tab" [class.active]="activeCategory() === cat.id"
              (click)="activeCategory.set(cat.id)">
        {{ cat.name }}
      </button>
    }
  </div>
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
          <!-- Bouton photo -->
          @if (uploadingProductId() === product.id) {
            <span class="photo-label">
              <ion-spinner name="crescent" style="width:12px;height:12px"></ion-spinner>
              Envoi…
            </span>
          } @else if (justUploadedId() === product.id) {
            <span class="photo-label" style="background:#dcfce7;color:#16a34a;border-color:#bbf7d0">
              ✓ Photo ajoutée
            </span>
          } @else {
            <label class="photo-label">
              <input type="file" accept="image/*" style="display:none"
                     (change)="uploadProductImage($event, product)" />
              📷 {{ product.imageUrl ? 'Changer' : 'Photo' }}
            </label>
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
        @if (product.imageUrl) {
          <img [src]="product.imageUrl" [alt]="product.name" class="product-img" />
        }
      </div>
    </ion-card>
  }

</ion-content>

<ion-footer>
  <ion-toolbar>
    <div class="footer-actions">
      <ion-button fill="outline" color="medium" size="small" (click)="goToTableOrders()">
        <ion-icon slot="start" name="list-outline"></ion-icon>
        Suivi table
      </ion-button>
      @if (cart.totalItems() > 0) {
        <ion-button color="primary" (click)="goToCart()" class="cart-btn">
          <ion-icon slot="start" name="cart-outline"></ion-icon>
          Panier ({{ cart.totalItems() }}) —
          {{ cart.totalTtc() | currency:'EUR':'symbol':'1.2-2':'fr' }}
          <ion-icon slot="end" name="arrow-forward-outline"></ion-icon>
        </ion-button>
      }
    </div>
  </ion-toolbar>
</ion-footer>
  `,
  styles: [`
    /* ── Barre de recherche ── */
    .search-wrapper { padding: 8px 14px; background: #fff; }
    .native-search {
      width: 100%; box-sizing: border-box;
      padding: 10px 14px 10px 38px; border-radius: 12px;
      border: 1.5px solid #e5e7eb; background: #f9fafb url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%239ca3af' viewBox='0 0 16 16'%3E%3Cpath d='M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.656a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z'/%3E%3C/svg%3E") no-repeat 12px center;
      font-size: 14px; outline: none; color: #111;
      &:focus { border-color: var(--ion-color-primary); background-color: #fff; }
    }

    /* ── Onglets catégories ── */
    .cat-tabs {
      display: flex; overflow-x: auto; background: #fff;
      border-bottom: 1px solid #f0f0f0;
      padding: 0 12px; gap: 4px;
      scrollbar-width: none; &::-webkit-scrollbar { display: none; }
    }
    .cat-tab {
      flex-shrink: 0; border: none; background: none;
      padding: 12px 14px; font-size: 13px; font-weight: 500;
      color: #6b7280; cursor: pointer;
      border-bottom: 2.5px solid transparent; white-space: nowrap;
      transition: color .15s;
    }
    .cat-tab.active {
      color: var(--ion-color-primary);
      border-bottom-color: var(--ion-color-primary);
      font-weight: 700;
    }

    /* ── Spinner ── */
    .center-spinner { display: flex; justify-content: center; padding: 60px; }

    /* ── Section upsell ── */
    .upsell-section { padding: 16px 16px 4px; }
    .upsell-section h3 {
      font-size: 13px; font-weight: 700; color: #374151;
      text-transform: uppercase; letter-spacing: .06em; margin: 0 0 12px;
    }
    .upsell-scroll { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 12px; scrollbar-width: none; &::-webkit-scrollbar { display: none; } }
    .upsell-card {
      min-width: 130px; max-width: 130px; margin: 0;
      cursor: pointer; border-radius: 12px; overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,.08);
    }
    .upsell-img { width: 100%; height: 85px; object-fit: cover; }

    /* ── Carte produit ── */
    .product-card {
      margin: 0; border-radius: 0; box-shadow: none;
      border-bottom: 1px solid #f3f4f6;
      --background: #fff;
    }
    .product-card__inner {
      display: flex; align-items: center;
      gap: 14px; padding: 14px 16px;
    }
    .product-info { flex: 1; min-width: 0; }
    .product-name {
      font-weight: 700; font-size: 15px; color: #111827;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .product-desc {
      font-size: 12px; color: #9ca3af; margin-top: 3px;
      line-height: 1.4; display: -webkit-box;
      -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .allergens { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
    .product-footer {
      display: flex; align-items: center; justify-content: space-between;
      margin-top: 10px;
    }
    .product-price {
      font-size: 16px; font-weight: 800; color: #111827;
    }
    .qty-controls { display: flex; align-items: center; gap: 2px; }
    .qty-badge {
      font-weight: 700; font-size: 15px; min-width: 22px; text-align: center; color: #111827;
    }
    .product-img {
      width: 90px; height: 90px; object-fit: cover;
      border-radius: 10px; flex-shrink: 0;
    }

    /* ── Bouton photo ── */
    .photo-label {
      display: inline-flex; align-items: center; gap: 4px;
      margin-top: 8px; padding: 4px 10px;
      border-radius: 20px; border: 1px solid #e5e7eb;
      background: #f9fafb; color: #6b7280;
      font-size: 11px; font-weight: 600; cursor: pointer;
    }

    /* ── Footer ── */
    .footer-actions {
      display: flex; align-items: center; gap: 8px; padding: 8px 14px;
      .cart-btn { flex: 1; --border-radius: 10px; font-weight: 700; }
    }
  `]
})
export class MenuPage implements OnInit {
  private route        = inject(ActivatedRoute);
  private router       = inject(Router);
  private menuService  = inject(MenuService);
  private http         = inject(HttpClient);
  private destroyRef   = inject(DestroyRef);
  readonly cart        = inject(CartService);

  categories           = signal<Category[]>([]);
  allProducts          = signal<Product[]>([]);
  loading              = signal(true);
  tableToken           = signal('');
  tableLabel           = signal('');
  searchQuery          = signal('');
  activeCategory       = signal('');
  uploadingProductId   = signal<string | null>(null);
  justUploadedId       = signal<string | null>(null);

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
    addIcons({ cartOutline, addCircleOutline, removeCircleOutline, arrowForwardOutline, listOutline, chevronBackOutline, cameraOutline, checkmarkCircleOutline });
  }

  ngOnInit(): void {
    this.route.queryParams.pipe(
      switchMap(params => {
        this.tableToken.set(params['t'] ?? '');
        return this.menuService.getMenuByToken(params['t']);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(menu => {
      this.categories.set(menu.categories);
      this.allProducts.set(menu.products);
      this.tableLabel.set(menu.tableLabel);
      this.cart.initTable(menu.tableId, menu.tableLabel, this.tableToken());
      this.loading.set(false);
    });
  }

  addToCart(product: Product): void     { this.cart.add(product); }
  removeFromCart(product: Product): void { this.cart.remove(product.id); }
  getQty(productId: string): number     { return this.cart.getQty(productId); }

  goToCart(): void {
    this.router.navigate(['/order-confirm'], { queryParams: { t: this.tableToken() } });
  }

  goToTableOrders(): void {
    this.router.navigate(['/table-orders'], { queryParams: { t: this.tableToken() } });
  }

  uploadProductImage(event: Event, product: Product): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploadingProductId.set(product.id);
    this.justUploadedId.set(null);

    const formData = new FormData();
    formData.append('file', file);

    this.http.post<{ imageUrl: string }>(
      `/public/products/${product.id}/image?t=${encodeURIComponent(this.tableToken())}`,
      formData
    ).subscribe({
      next: (res) => {
        this.allProducts.update(list =>
          list.map(p => p.id === product.id ? { ...p, imageUrl: res.imageUrl } : p)
        );
        this.uploadingProductId.set(null);
        this.justUploadedId.set(product.id);
        setTimeout(() => this.justUploadedId.set(null), 3000);
        // Reset input so same file can be re-selected
        input.value = '';
      },
      error: () => {
        this.uploadingProductId.set(null);
        input.value = '';
      }
    });
  }
}
