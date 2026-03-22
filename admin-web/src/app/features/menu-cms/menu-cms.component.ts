import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule, CurrencyPipe }          from '@angular/common';
import { HttpClient }                          from '@angular/common/http';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatButtonModule }  from '@angular/material/button';
import { MatIconModule }    from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule }   from '@angular/material/input';
import { MatSelectModule }  from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';

interface Category {
  id: string;
  name: string;
  sortOrder: number;
  visible: boolean;
}

interface Product {
  id: string;
  name: string;
  description: string;
  categoryId: string | null;
  priceHt: number;
  priceTtc: number;
  vatRate: number;
  costPrice?: number;
  available: boolean;
  upsell: boolean;
  sortOrder: number;
  imageUrl?: string | null;
}

@Component({
  selector: 'app-menu-cms',
  standalone: true,
  imports: [
    CommonModule, CurrencyPipe, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatSlideToggleModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule,
  ],
  template: `
<div class="cms-layout">

  <!-- ── En-tête ─────────────────────────────────────────────────── -->
  <div class="cms-header">
    <div>
      <h1>Gestion du Menu</h1>
      <span class="cms-subtitle">{{ products().length }} article(s) · {{ categories().length }} catégorie(s)</span>
    </div>
    <div class="header-actions">
      <button mat-stroked-button (click)="openCategoryForm(null)">
        <mat-icon>create_new_folder</mat-icon> Nouvelle catégorie
      </button>
      <button mat-flat-button class="btn-add" (click)="openProductForm(null)">
        <mat-icon>add</mat-icon> Nouveau plat
      </button>
    </div>
  </div>

  @if (loading()) {
    <div class="spinner-center"><mat-spinner diameter="48"></mat-spinner></div>
  } @else {

    <div class="cms-body">

      <!-- ── Sidebar catégories ───────────────────────────────────── -->
      <aside class="cat-sidebar">
        <div class="cat-sidebar__label">Catégories</div>

        <button class="cat-item" [class.cat-item--active]="!selectedCategoryId()"
                (click)="selectedCategoryId.set(null)">
          <mat-icon>grid_view</mat-icon>
          <span>Tous les articles</span>
          <span class="cat-count">{{ products().length }}</span>
        </button>

        @for (cat of categories(); track cat.id) {
          <div class="cat-item" [class.cat-item--active]="selectedCategoryId() === cat.id">
            <mat-icon (click)="selectedCategoryId.set(cat.id)" class="cat-item__icon">folder</mat-icon>
            <span (click)="selectedCategoryId.set(cat.id)" class="cat-item__name">{{ cat.name }}</span>
            <span class="cat-count">{{ countInCat(cat.id) }}</span>
            <div class="cat-actions">
              <button mat-icon-button class="cat-edit-btn" (click)="openCategoryForm(cat)" matTooltip="Renommer">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button class="cat-edit-btn" color="warn" (click)="deleteCategory(cat)" matTooltip="Supprimer">
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          </div>
        }
      </aside>

      <!-- ── Liste des produits ───────────────────────────────────── -->
      <main class="products-main">

        <div class="products-toolbar">
          <span class="products-toolbar__title">
            {{ selectedCategoryId() ? (categoryName() + ' — ') : '' }}{{ filteredProducts().length }} article(s)
          </span>
          <button mat-stroked-button (click)="openProductForm(null)">
            <mat-icon>add</mat-icon> Ajouter un plat
          </button>
        </div>

        @if (filteredProducts().length === 0) {
          <div class="empty-state">
            <mat-icon>restaurant_menu</mat-icon>
            <p>Aucun article dans cette catégorie</p>
            <button mat-flat-button class="btn-add" (click)="openProductForm(null)">Ajouter un plat</button>
          </div>
        }

        <div class="products-grid">
          @for (p of filteredProducts(); track p.id) {
            <div class="product-card" [class.product-card--unavailable]="!p.available">
              <div class="product-card__body">
                @if (p.imageUrl) {
                  <img [src]="p.imageUrl" [alt]="p.name" class="product-card__thumb" />
                }
                <div class="product-card__info">
                  <div class="product-card__name">
                    {{ p.name }}
                    @if (p.upsell) { <span class="badge badge--upsell">Upsell</span> }
                    @if (!p.available) { <span class="badge badge--off">Indisponible</span> }
                  </div>
                  @if (p.description) {
                    <div class="product-card__desc">{{ p.description }}</div>
                  }
                  <div class="product-card__meta">
                    <span class="product-card__cat">{{ getCategoryName(p.categoryId) }}</span>
                    <span>·</span>
                    <span>TVA {{ p.vatRate }}%</span>
                  </div>
                </div>
                <div class="product-card__price">
                  <span class="price-ttc">{{ p.priceTtc | currency:'EUR':'symbol':'1.2-2':'fr' }}</span>
                  <span class="price-ht">HT {{ p.priceHt | currency:'EUR':'symbol':'1.2-2':'fr' }}</span>
                </div>
              </div>
              <div class="product-card__actions">
                <button mat-icon-button (click)="toggleAvailability(p)" [matTooltip]="p.available ? 'Rendre indisponible' : 'Rendre disponible'">
                  <mat-icon>{{ p.available ? 'visibility' : 'visibility_off' }}</mat-icon>
                </button>
                <button mat-icon-button (click)="openProductForm(p)" matTooltip="Modifier">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button color="warn" (click)="deleteProduct(p)" matTooltip="Supprimer">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </div>
          }
        </div>
      </main>

      <!-- ── Panneau formulaire ───────────────────────────────────── -->
      @if (panelMode()) {
        <aside class="form-panel">

          <div class="form-panel__header">
            <span>{{ panelMode() === 'product' ? (editingProduct()?.id ? 'Modifier le plat' : 'Nouveau plat') : (editingCategory()?.id ? 'Modifier la catégorie' : 'Nouvelle catégorie') }}</span>
            <button mat-icon-button (click)="closePanel()"><mat-icon>close</mat-icon></button>
          </div>

          <!-- Formulaire produit -->
          @if (panelMode() === 'product') {
            <form [formGroup]="productForm" (ngSubmit)="saveProduct()" class="form-panel__form">

              <mat-form-field appearance="outline">
                <mat-label>Nom du plat</mat-label>
                <input matInput formControlName="name" placeholder="ex: Entrecôte 300g" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Description</mat-label>
                <textarea matInput formControlName="description" rows="2" placeholder="Ingrédients, préparation…"></textarea>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Catégorie</mat-label>
                <mat-select formControlName="categoryId">
                  <mat-option [value]="null">— Sans catégorie —</mat-option>
                  @for (cat of categories(); track cat.id) {
                    <mat-option [value]="cat.id">{{ cat.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <div class="form-row">
                <mat-form-field appearance="outline">
                  <mat-label>Prix HT (€)</mat-label>
                  <input matInput type="number" formControlName="priceHt" step="0.01" min="0" />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>TVA</mat-label>
                  <mat-select formControlName="vatRate">
                    <mat-option [value]="5.5">5,5% — Alim. de base</mat-option>
                    <mat-option [value]="10">10% — Restauration</mat-option>
                    <mat-option [value]="20">20% — Alcools / autre</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline">
                <mat-label>Coût matière HT (€) — optionnel</mat-label>
                <input matInput type="number" formControlName="costPrice" step="0.01" min="0" />
                <mat-hint>Utilisé pour calculer la marge brute</mat-hint>
              </mat-form-field>

              <div class="form-toggles">
                <mat-slide-toggle formControlName="available" color="primary">Disponible</mat-slide-toggle>
                <mat-slide-toggle formControlName="upsell" color="accent">Upselling</mat-slide-toggle>
              </div>

              <!-- Image du plat -->
              <div class="img-upload-section">
                @if (currentImageUrl()) {
                  <img [src]="currentImageUrl()!" class="img-preview" alt="Aperçu" />
                } @else {
                  <div class="img-placeholder">
                    <mat-icon>image</mat-icon>
                    <span>Aucune image</span>
                  </div>
                }
                @if (editingProduct()?.id) {
                  <div class="img-actions">
                    <input #fileInput type="file" accept="image/*" style="display:none"
                           (change)="uploadImage($event)" />
                    <button mat-stroked-button type="button" [disabled]="uploadingImage()"
                            (click)="fileInput.click()">
                      @if (uploadingImage()) {
                        <mat-spinner diameter="16" style="display:inline-block;margin-right:6px"></mat-spinner>
                      } @else {
                        <mat-icon>upload</mat-icon>
                      }
                      {{ currentImageUrl() ? 'Changer' : 'Ajouter une image' }}
                    </button>
                    @if (currentImageUrl()) {
                      <button mat-icon-button type="button" color="warn" title="Supprimer l'image"
                              (click)="removeImage()">
                        <mat-icon>delete</mat-icon>
                      </button>
                    }
                  </div>
                } @else {
                  <p class="img-hint">Créez le plat puis modifiez-le pour ajouter une image.</p>
                }
              </div>

              <div class="form-panel__footer">
                <button mat-button type="button" (click)="closePanel()">Annuler</button>
                <button mat-flat-button class="btn-add" type="submit" [disabled]="productForm.invalid || saving()">
                  @if (saving()) { <mat-spinner diameter="18"></mat-spinner> }
                  {{ editingProduct()?.id ? 'Mettre à jour' : 'Créer le plat' }}
                </button>
              </div>
            </form>
          }

          <!-- Formulaire catégorie -->
          @if (panelMode() === 'category') {
            <form [formGroup]="categoryForm" (ngSubmit)="saveCategory()" class="form-panel__form">

              <mat-form-field appearance="outline">
                <mat-label>Nom de la catégorie</mat-label>
                <input matInput formControlName="name" placeholder="ex: Plats, Desserts, Boissons…" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Ordre d'affichage</mat-label>
                <input matInput type="number" formControlName="sortOrder" min="0" />
              </mat-form-field>

              <div class="form-panel__footer">
                <button mat-button type="button" (click)="closePanel()">Annuler</button>
                <button mat-flat-button class="btn-add" type="submit" [disabled]="categoryForm.invalid || saving()">
                  @if (saving()) { <mat-spinner diameter="18"></mat-spinner> }
                  {{ editingCategory()?.id ? 'Mettre à jour' : 'Créer la catégorie' }}
                </button>
              </div>
            </form>
          }

        </aside>
      }

    </div>
  }

</div>
  `,
  styles: [`
    /* ── Layout ── */
    .cms-layout {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: #f9fafb;
      overflow: hidden;
    }

    /* ── Header ── */
    .cms-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px 16px;
      background: white;
      border-bottom: 1px solid #e5e7eb;
      flex-shrink: 0;
    }
    .cms-header h1 { margin: 0 0 2px; font-size: 20px; font-weight: 700; color: #111827; }
    .cms-subtitle   { font-size: 13px; color: #6b7280; }
    .header-actions { display: flex; gap: 10px; }
    .btn-add { background: #2563eb !important; color: white !important; border-radius: 8px !important; }

    .spinner-center { display: flex; justify-content: center; padding: 80px; }

    /* ── Body ── */
    .cms-body {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    /* ── Sidebar catégories ── */
    .cat-sidebar {
      width: 220px;
      flex-shrink: 0;
      background: white;
      border-right: 1px solid #e5e7eb;
      overflow-y: auto;
      padding: 12px 8px;
    }
    .cat-sidebar__label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .06em;
      color: #9ca3af;
      padding: 4px 12px 8px;
    }
    .cat-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      color: #374151;
      border: none;
      background: transparent;
      width: 100%;
      text-align: left;
      transition: background .1s;
      &:hover { background: #f3f4f6; }
      &:hover .cat-actions { opacity: 1; }
    }
    .cat-item--active {
      background: #eff6ff;
      color: #2563eb;
      mat-icon { color: #2563eb; }
    }
    .cat-item__icon { font-size: 18px; width: 18px; height: 18px; color: #9ca3af; flex-shrink: 0; }
    .cat-item__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cat-count {
      font-size: 11px;
      background: #f3f4f6;
      color: #6b7280;
      border-radius: 10px;
      padding: 1px 7px;
      flex-shrink: 0;
    }
    .cat-actions {
      display: flex;
      opacity: 0;
      transition: opacity .1s;
      button { width: 24px; height: 24px; line-height: 24px; mat-icon { font-size: 14px; } }
    }
    .cat-edit-btn { width: 28px !important; height: 28px !important; }

    /* ── Produits ── */
    .products-main {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      min-width: 0;
    }
    .products-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    .products-toolbar__title { font-weight: 600; font-size: 15px; color: #374151; }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #9ca3af;
      mat-icon { font-size: 48px; width: 48px; height: 48px; opacity: .4; }
      p { margin: 12px 0 20px; }
    }

    .products-grid {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .product-card {
      background: white;
      border-radius: 10px;
      border: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
      padding: 12px 16px;
      gap: 12px;
      transition: box-shadow .15s;
      &:hover { box-shadow: 0 2px 8px rgba(0,0,0,.08); }
    }
    .product-card--unavailable { opacity: .6; }
    .product-card__body { flex: 1; display: flex; align-items: center; gap: 16px; min-width: 0; }
    .product-card__info { flex: 1; min-width: 0; }
    .product-card__name {
      font-weight: 600;
      font-size: 14px;
      color: #111827;
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .product-card__desc { font-size: 12px; color: #6b7280; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .product-card__meta { font-size: 11px; color: #9ca3af; margin-top: 4px; display: flex; gap: 4px; }
    .product-card__cat { font-weight: 500; color: #6b7280; }
    .product-card__price { text-align: right; flex-shrink: 0; }
    .price-ttc { display: block; font-weight: 700; font-size: 16px; color: #111827; }
    .price-ht  { display: block; font-size: 11px; color: #9ca3af; }
    .product-card__actions { display: flex; gap: 2px; flex-shrink: 0; }

    .badge {
      font-size: 10px;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 10px;
      text-transform: uppercase;
      letter-spacing: .03em;
    }
    .badge--upsell { background: #fef3c7; color: #92400e; }
    .badge--off    { background: #fee2e2; color: #991b1b; }

    /* ── Panneau formulaire ── */
    .form-panel {
      width: 340px;
      flex-shrink: 0;
      background: white;
      border-left: 1px solid #e5e7eb;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }
    .form-panel__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      font-weight: 600;
      font-size: 15px;
      border-bottom: 1px solid #e5e7eb;
      flex-shrink: 0;
    }
    .form-panel__form {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px 20px;
      flex: 1;
      mat-form-field { width: 100%; }
    }
    .form-row { display: flex; gap: 10px; mat-form-field { flex: 1; } }
    .form-toggles { display: flex; flex-direction: column; gap: 12px; padding: 8px 0; }
    .form-panel__footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 16px 20px;
      border-top: 1px solid #e5e7eb;
      margin-top: auto;
    }

    .img-upload-section {
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      overflow: hidden;
    }
    .img-preview {
      width: 100%; height: 160px; object-fit: cover; display: block;
    }
    .img-placeholder {
      height: 120px; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 8px;
      background: #f9fafb; color: #9ca3af;
      mat-icon { font-size: 36px; width: 36px; height: 36px; }
      span { font-size: 13px; }
    }
    .img-actions {
      display: flex; align-items: center; gap: 8px; padding: 10px 12px;
      background: #f9fafb; border-top: 1px solid #e5e7eb;
      button:first-of-type { flex: 1; }
    }
    .img-hint { font-size: 11px; color: #9ca3af; text-align: center; padding: 8px 12px; margin: 0; }

    .product-card__thumb { width: 48px; height: 48px; object-fit: cover; border-radius: 6px; flex-shrink: 0; }
  `]
})
export class MenuCmsComponent implements OnInit {
  categories      = signal<Category[]>([]);
  products        = signal<Product[]>([]);
  loading         = signal(true);
  saving          = signal(false);
  selectedCategoryId = signal<string | null>(null);
  panelMode       = signal<'product' | 'category' | null>(null);
  editingProduct  = signal<Product | null>(null);
  editingCategory = signal<Category | null>(null);
  uploadingImage  = signal(false);
  currentImageUrl = signal<string | null>(null);

  filteredProducts = computed(() => {
    const catId = this.selectedCategoryId();
    if (!catId) return this.products();
    return this.products().filter(p => p.categoryId === catId);
  });

  categoryName = computed(() => {
    const id = this.selectedCategoryId();
    return this.categories().find(c => c.id === id)?.name ?? '';
  });

  productForm = this.fb.group({
    name:        ['', [Validators.required, Validators.maxLength(150)]],
    description: [''],
    categoryId:  [null as string | null],
    priceHt:     [null as number | null, [Validators.required, Validators.min(0)]],
    vatRate:     [10, Validators.required],
    costPrice:   [null as number | null],
    available:   [true],
    upsell:      [false],
  });

  categoryForm = this.fb.group({
    name:      ['', [Validators.required, Validators.maxLength(100)]],
    sortOrder: [0],
  });

  constructor(
    private http:     HttpClient,
    private fb:       FormBuilder,
    private snack:    MatSnackBar,
    private dialog:   MatDialog,
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  private loadAll(): void {
    this.loading.set(true);
    this.http.get<Category[]>('/categories').subscribe({
      next: cats => {
        this.categories.set(cats);
        this.http.get<Product[]>('/products').subscribe({
          next:  prods => { this.products.set(prods); this.loading.set(false); },
          error: ()    => { this.loading.set(false); this.snack.open('Erreur lors du chargement des produits', 'Fermer', { duration: 4000 }); },
        });
      },
      error: () => { this.loading.set(false); this.snack.open('Erreur lors du chargement des catégories', 'Fermer', { duration: 4000 }); },
    });
  }

  countInCat(catId: string): number {
    return this.products().filter(p => p.categoryId === catId).length;
  }

  getCategoryName(catId: string | null): string {
    if (!catId) return '—';
    return this.categories().find(c => c.id === catId)?.name ?? '—';
  }

  // ── Catégories ────────────────────────────────────────────────────

  openCategoryForm(cat: Category | null): void {
    this.editingCategory.set(cat);
    this.panelMode.set('category');
    this.categoryForm.reset({ name: cat?.name ?? '', sortOrder: cat?.sortOrder ?? 0 });
  }

  saveCategory(): void {
    if (this.categoryForm.invalid) return;
    this.saving.set(true);
    const dto = this.categoryForm.value;
    const cat = this.editingCategory();
    const req$ = cat?.id
      ? this.http.put<Category>(`/categories/${cat.id}`, dto)
      : this.http.post<Category>('/categories', dto);

    req$.subscribe({
      next: saved => {
        if (cat?.id) {
          this.categories.update(list => list.map(c => c.id === saved.id ? saved : c));
        } else {
          this.categories.update(list => [...list, saved]);
        }
        this.saving.set(false);
        this.closePanel();
        this.snack.open(cat?.id ? 'Catégorie mise à jour' : 'Catégorie créée', '', { duration: 2500 });
      },
      error: () => { this.saving.set(false); this.snack.open('Erreur lors de la sauvegarde', 'Fermer', { duration: 4000 }); }
    });
  }

  deleteCategory(cat: Category): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Supprimer la catégorie',
        message: `Supprimer la catégorie « ${cat.name} » ? Tous les plats associés seront également supprimés.`,
        confirmLabel: 'Supprimer',
        danger: true
      }
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.http.delete(`/categories/${cat.id}`).subscribe({
        next: () => {
          this.categories.update(list => list.filter(c => c.id !== cat.id));
          if (this.selectedCategoryId() === cat.id) this.selectedCategoryId.set(null);
          this.snack.open('Catégorie supprimée', '', { duration: 2500 });
        },
        error: () => this.snack.open('Impossible de supprimer cette catégorie', 'Fermer', { duration: 4000 })
      });
    });
  }

  // ── Produits ──────────────────────────────────────────────────────

  openProductForm(p: Product | null): void {
    this.editingProduct.set(p);
    this.panelMode.set('product');
    this.productForm.reset({
      name:        p?.name        ?? '',
      description: p?.description ?? '',
      categoryId:  p?.categoryId  ?? this.selectedCategoryId() ?? null,
      priceHt:     p?.priceHt     ?? null,
      vatRate:     p?.vatRate     ?? 10,
      costPrice:   p?.costPrice   ?? null,
      available:   p?.available   ?? true,
      upsell:      p?.upsell      ?? false,
    });
    this.currentImageUrl.set(p?.imageUrl ?? null);
  }

  saveProduct(): void {
    if (this.productForm.invalid) return;
    this.saving.set(true);
    const v   = this.productForm.value;
    const p   = this.editingProduct();
    const maxSort = p?.id ? p.sortOrder : this.products().reduce((max, x) => Math.max(max, x.sortOrder), -1);
    const dto = { ...v, sortOrder: p?.id ? maxSort : maxSort + 1 };
    const req$ = p?.id
      ? this.http.put<Product>(`/products/${p.id}`, dto)
      : this.http.post<Product>('/products', dto);

    req$.subscribe({
      next: saved => {
        if (p?.id) {
          this.products.update(list => list.map(x => x.id === saved.id ? saved : x));
        } else {
          this.products.update(list => [...list, saved]);
        }
        this.saving.set(false);
        this.closePanel();
        this.snack.open(p?.id ? 'Plat mis à jour' : 'Plat créé', '', { duration: 2500 });
      },
      error: () => { this.saving.set(false); this.snack.open('Erreur lors de la sauvegarde', 'Fermer', { duration: 4000 }); }
    });
  }

  uploadImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const productId = this.editingProduct()?.id;
    if (!productId) return;

    this.uploadingImage.set(true);
    const formData = new FormData();
    formData.append('file', file);

    this.http.post<{ imageUrl: string }>(`/products/${productId}/image`, formData).subscribe({
      next: res => {
        this.currentImageUrl.set(res.imageUrl);
        this.products.update(list =>
          list.map(p => p.id === productId ? { ...p, imageUrl: res.imageUrl } : p)
        );
        this.uploadingImage.set(false);
        this.snack.open('Image mise à jour', '', { duration: 2000 });
      },
      error: () => {
        this.uploadingImage.set(false);
        this.snack.open('Erreur lors de l\'upload', 'Fermer', { duration: 4000 });
      }
    });
    input.value = '';
  }

  removeImage(): void {
    const productId = this.editingProduct()?.id;
    if (!productId) return;
    const dto = { ...this.productForm.value, imageUrl: null, sortOrder: this.editingProduct()!.sortOrder };
    this.http.put<Product>(`/products/${productId}`, dto).subscribe({
      next: saved => {
        this.currentImageUrl.set(null);
        this.products.update(list => list.map(p => p.id === saved.id ? saved : p));
        this.snack.open('Image supprimée', '', { duration: 2000 });
      },
      error: () => this.snack.open('Erreur', 'Fermer', { duration: 3000 })
    });
  }

  toggleAvailability(p: Product): void {
    const updated = { ...p, available: !p.available };
    this.http.put<Product>(`/products/${p.id}`, {
      name: p.name, description: p.description, categoryId: p.categoryId,
      priceHt: p.priceHt, vatRate: p.vatRate, costPrice: p.costPrice,
      upsell: p.upsell, available: !p.available, sortOrder: p.sortOrder,
    }).subscribe({
      next: saved => this.products.update(list => list.map(x => x.id === saved.id ? saved : x)),
      error: () => this.snack.open('Erreur', 'Fermer', { duration: 3000 })
    });
  }

  deleteProduct(p: Product): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Supprimer le plat',
        message: `Supprimer « ${p.name} » du menu ?`,
        confirmLabel: 'Supprimer',
        danger: true
      }
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.http.delete(`/products/${p.id}`).subscribe({
        next: () => {
          this.products.update(list => list.filter(x => x.id !== p.id));
          this.snack.open('Plat supprimé', '', { duration: 2500 });
        },
        error: () => this.snack.open('Erreur lors de la suppression', 'Fermer', { duration: 4000 })
      });
    });
  }

  closePanel(): void {
    this.panelMode.set(null);
    this.editingProduct.set(null);
    this.editingCategory.set(null);
  }
}
