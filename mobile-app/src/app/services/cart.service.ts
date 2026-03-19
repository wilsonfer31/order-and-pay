import { Injectable, signal, computed } from '@angular/core';
import { Product } from './menu.service';

export interface CartItem {
  product: Product;
  quantity: number;
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private items = signal<CartItem[]>([]);

  tableId    = signal('');
  tableLabel = signal('');

  readonly totalItems = computed(() =>
    this.items().reduce((sum, i) => sum + i.quantity, 0)
  );

  readonly totalTtc = computed(() =>
    this.items().reduce((sum, i) => sum + i.product.priceTtc * i.quantity, 0)
  );

  readonly cartItems = this.items.asReadonly();

  initTable(tableId: string, label: string): void {
    this.tableId.set(tableId);
    this.tableLabel.set(label);
  }

  add(product: Product, qty = 1): void {
    this.items.update(items => {
      const existing = items.find(i => i.product.id === product.id);
      if (existing) {
        return items.map(i =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + qty }
            : i
        );
      }
      return [...items, { product, quantity: qty }];
    });
  }

  remove(productId: string): void {
    this.items.update(items => {
      const existing = items.find(i => i.product.id === productId);
      if (!existing) return items;
      if (existing.quantity <= 1) {
        return items.filter(i => i.product.id !== productId);
      }
      return items.map(i =>
        i.product.id === productId
          ? { ...i, quantity: i.quantity - 1 }
          : i
      );
    });
  }

  getQty(productId: string): number {
    return this.items().find(i => i.product.id === productId)?.quantity ?? 0;
  }

  clear(): void {
    this.items.set([]);
  }

  toOrderPayload() {
    return {
      tableId: this.tableId(),
      source: 'CLIENT_APP',
      lines: this.items().map(i => ({
        productId: i.product.id,
        quantity:  i.quantity,
        notes:     i.notes ?? null
      }))
    };
  }
}
