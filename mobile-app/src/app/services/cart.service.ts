import { Injectable, signal, computed } from '@angular/core';
import { Product } from './menu.service';

export interface SelectedOption {
  optionId:     string;
  optionName:   string;
  valueId:      string;
  label:        string;
  priceDeltaHt: number;
  priceDeltaTtc: number;
}

export interface CartItem {
  product:         Product;
  quantity:        number;
  notes?:          string;
  selectedOptions: SelectedOption[];
  /** Clé unique : productId + valueIds triés — permet plusieurs lignes pour le même produit avec des options différentes. */
  itemKey:         string;
}

function buildItemKey(productId: string, valueIds: string[]): string {
  return productId + ':' + [...valueIds].sort().join(',');
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private items = signal<CartItem[]>([]);

  tableId    = signal('');
  tableLabel = signal('');
  tableToken = signal('');

  readonly totalItems = computed(() =>
    this.items().reduce((sum, i) => sum + i.quantity, 0)
  );

  readonly totalTtc = computed(() =>
    this.items().reduce((sum, i) => {
      const optsDeltaTtc = i.selectedOptions.reduce((s, o) => s + o.priceDeltaTtc, 0);
      return sum + (i.product.priceTtc + optsDeltaTtc) * i.quantity;
    }, 0)
  );

  readonly cartItems = this.items.asReadonly();

  initTable(tableId: string, label: string, token: string = ''): void {
    this.tableId.set(tableId);
    this.tableLabel.set(label);
    this.tableToken.set(token);
  }

  add(product: Product, qty = 1, selectedOptions: SelectedOption[] = []): void {
    const key = buildItemKey(product.id, selectedOptions.map(o => o.valueId));
    this.items.update(items => {
      const existing = items.find(i => i.itemKey === key);
      if (existing) {
        return items.map(i =>
          i.itemKey === key ? { ...i, quantity: i.quantity + qty } : i
        );
      }
      return [...items, { product, quantity: qty, selectedOptions, itemKey: key }];
    });
  }

  /** Décrémente la dernière ligne trouvée pour ce productId. */
  remove(productId: string): void {
    this.items.update(items => {
      for (let i = items.length - 1; i >= 0; i--) {
        if (items[i].product.id === productId) {
          if (items[i].quantity <= 1) {
            return items.filter((_, idx) => idx !== i);
          }
          return items.map((it, idx) =>
            idx === i ? { ...it, quantity: it.quantity - 1 } : it
          );
        }
      }
      return items;
    });
  }

  incrementItem(index: number): void {
    this.items.update(items =>
      items.map((item, i) => i === index ? { ...item, quantity: item.quantity + 1 } : item)
    );
  }

  decrementItem(index: number): void {
    this.items.update(items => {
      const item = items[index];
      if (!item) return items;
      if (item.quantity <= 1) return items.filter((_, i) => i !== index);
      return items.map((it, i) => i === index ? { ...it, quantity: it.quantity - 1 } : it);
    });
  }

  getQty(productId: string): number {
    return this.items()
      .filter(i => i.product.id === productId)
      .reduce((sum, i) => sum + i.quantity, 0);
  }

  clear(): void {
    this.items.set([]);
  }

  toOrderPayload() {
    return {
      tableId:    this.tableId(),
      tableToken: this.tableToken(),
      source:     'CLIENT_APP',
      lines: this.items().map(i => ({
        productId:      i.product.id,
        quantity:       i.quantity,
        notes:          i.notes ?? null,
        optionValueIds: i.selectedOptions.map(o => o.valueId),
      }))
    };
  }
}
