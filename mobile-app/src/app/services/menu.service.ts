import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Category {
  id: string;
  name: string;
  imageUrl?: string;
  sortOrder: number;
}

export interface ProductOptionValue {
  id: string;
  label: string;
  priceDeltaHt: number;
}

export interface ProductOption {
  id: string;
  name: string;
  required: boolean;
  maxChoices: number;
  values: ProductOptionValue[];
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  priceHt: number;
  priceTtc: number;
  vatRate: number;
  allergens?: string[];
  available: boolean;
  upsell: boolean;
  options: ProductOption[];
}

export interface MenuResponse {
  tableId: string;
  tableLabel: string;
  restaurantName: string;
  categories: Category[];
  products: Product[];
}

@Injectable({ providedIn: 'root' })
export class MenuService {
  constructor(private http: HttpClient) {}

  /** Endpoint public — pas d'auth requise, seulement le token QR. */
  getMenuByToken(token: string): Observable<MenuResponse> {
    return this.http.get<MenuResponse>(`/public/menu`, { params: { t: token } });
  }
}
