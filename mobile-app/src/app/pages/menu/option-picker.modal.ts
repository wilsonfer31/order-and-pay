import { Component, Input, signal, computed } from '@angular/core';
import { CommonModule, CurrencyPipe }         from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonButton,
  IonButtons, IonIcon, ModalController
} from '@ionic/angular/standalone';
import { addIcons }      from 'ionicons';
import { closeOutline, checkmarkOutline } from 'ionicons/icons';
import { Product, ProductOption, ProductOptionValue } from '../../services/menu.service';
import { SelectedOption } from '../../services/cart.service';

@Component({
  selector: 'app-option-picker',
  standalone: true,
  imports: [
    CommonModule, CurrencyPipe,
    IonHeader, IonToolbar, IonTitle, IonButton,
    IonButtons, IonIcon,
  ],
  template: `
<ion-header>
  <ion-toolbar color="primary">
    <ion-buttons slot="start">
      <ion-button (click)="dismiss()">
        <ion-icon slot="icon-only" name="close-outline"></ion-icon>
      </ion-button>
    </ion-buttons>
    <ion-title>{{ product.name }}</ion-title>
  </ion-toolbar>
</ion-header>

<div class="modal-body">
  <div class="options-scroll">
    @for (opt of product.options; track opt.id) {
      <div class="option-group">
        <div class="option-group__header">
          <span class="option-group__name">{{ opt.name }}</span>
          @if (opt.required) {
            <span class="badge-required">Obligatoire</span>
          } @else {
            <span class="badge-optional">Optionnel</span>
          }
          @if (opt.maxChoices > 1) {
            <span class="badge-max">Max {{ opt.maxChoices }}</span>
          }
        </div>
        <div class="option-values">
          @for (val of opt.values; track val.id) {
            <button
              class="option-val-btn"
              [class.selected]="isSelected(opt.id, val.id)"
              (click)="toggleValue(opt, val)">
              <div class="option-val-btn__check">
                @if (isSelected(opt.id, val.id)) {
                  <ion-icon name="checkmark-outline"></ion-icon>
                }
              </div>
              <span class="option-val-btn__label">{{ val.label }}</span>
              @if (val.priceDeltaHt > 0) {
                <span class="option-val-btn__delta">
                  +{{ val.priceDeltaHt * (1 + product.vatRate / 100) | currency:'EUR':'symbol':'1.2-2':'fr' }}
                </span>
              }
            </button>
          }
        </div>
      </div>
    }
  </div>

  <div class="confirm-area">
    @if (totalDeltaTtc() > 0) {
      <span class="footer-price">
        Supplément : +{{ totalDeltaTtc() | currency:'EUR':'symbol':'1.2-2':'fr' }}
      </span>
    }
    <button
      class="add-btn"
      [disabled]="!canConfirm()"
      (click)="confirm()">
      Ajouter au panier
    </button>
  </div>
</div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; background: #FFFBF7; }

    .modal-body {
      display: flex; flex-direction: column;
      flex: 1; overflow: hidden; background: #FFFBF7;
    }
    .options-scroll {
      flex: 1; overflow-y: auto;
      padding: 16px; display: flex; flex-direction: column; gap: 20px;
    }

    .option-group__header {
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 12px;
    }
    .option-group__name {
      font-size: 15px; font-weight: 700; color: #1C1917; flex: 1;
    }
    .badge-required {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      background: #FEE2E2; color: #991B1B;
      padding: 2px 8px; border-radius: 20px;
    }
    .badge-optional {
      font-size: 10px; font-weight: 600; text-transform: uppercase;
      background: #F3F4F6; color: #6B7280;
      padding: 2px 8px; border-radius: 20px;
    }
    .badge-max {
      font-size: 10px; font-weight: 600;
      background: #EFF6FF; color: #2563EB;
      padding: 2px 8px; border-radius: 20px;
    }

    .option-values { display: flex; flex-direction: column; gap: 8px; }

    .option-val-btn {
      display: flex; align-items: center; gap: 12px;
      width: 100%; text-align: left; padding: 12px 14px;
      border: 1.5px solid #E7E5E4; border-radius: 12px;
      background: #fff; cursor: pointer;
      transition: all .15s;
      &:active { transform: scale(.98); }
    }
    .option-val-btn.selected {
      border-color: #F97316;
      background: #FFF7ED;
    }
    .option-val-btn__check {
      width: 20px; height: 20px; border-radius: 50%;
      border: 2px solid #D1D5DB; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      transition: all .15s;
      ion-icon { display: none; }
    }
    .option-val-btn.selected .option-val-btn__check {
      border-color: #F97316; background: #F97316;
      ion-icon { display: block; color: white; font-size: 13px; }
    }
    .option-val-btn__label { flex: 1; font-size: 14px; font-weight: 600; color: #1C1917; }
    .option-val-btn__delta { font-size: 13px; font-weight: 700; color: #F97316; }

    .confirm-area {
      flex-shrink: 0;
      display: flex; flex-direction: column; gap: 8px;
      padding: 12px 16px 20px;
      background: #FFFBF7;
      border-top: 1px solid #F5F5F4;
    }
    .footer-price {
      font-size: 13px; font-weight: 600; color: #78716C;
      text-align: center;
    }
    .add-btn {
      width: 100%; padding: 14px 16px; border-radius: 14px;
      background: linear-gradient(135deg, #F97316, #EA580C); color: white;
      border: none; font-size: 16px; font-weight: 700; cursor: pointer;
      box-shadow: 0 4px 14px rgba(249,115,22,.35);
      &:disabled { opacity: .6; cursor: not-allowed; box-shadow: none; }
    }
  `]
})
export class OptionPickerModal {
  @Input() product!: Product;

  /** optionId → [valueId] */
  selectedValues = signal<Record<string, string[]>>({});

  canConfirm = computed(() => {
    if (!this.product) return false;
    return this.product.options.every(opt => {
      if (!opt.required) return true;
      return (this.selectedValues()[opt.id] ?? []).length > 0;
    });
  });

  totalDeltaTtc = computed(() => {
    if (!this.product) return 0;
    return this.product.options.reduce((total, opt) => {
      const selectedIds = this.selectedValues()[opt.id] ?? [];
      return total + opt.values
        .filter(v => selectedIds.includes(v.id))
        .reduce((s, v) => s + v.priceDeltaHt * (1 + this.product.vatRate / 100), 0);
    }, 0);
  });

  constructor(private modalCtrl: ModalController) {
    addIcons({ closeOutline, checkmarkOutline });
  }

  isSelected(optionId: string, valueId: string): boolean {
    return (this.selectedValues()[optionId] ?? []).includes(valueId);
  }

  toggleValue(opt: ProductOption, val: ProductOptionValue): void {
    this.selectedValues.update(sv => {
      const current = sv[opt.id] ?? [];
      if (opt.maxChoices === 1) {
        // Comportement radio : remplace la sélection
        return { ...sv, [opt.id]: [val.id] };
      } else {
        // Comportement checkbox : toggle dans la limite de maxChoices
        if (current.includes(val.id)) {
          return { ...sv, [opt.id]: current.filter(id => id !== val.id) };
        } else if (current.length < opt.maxChoices) {
          return { ...sv, [opt.id]: [...current, val.id] };
        }
        return sv; // limite atteinte
      }
    });
  }

  confirm(): void {
    const selectedOptions: SelectedOption[] = this.product.options.flatMap(opt =>
      opt.values
        .filter(v => (this.selectedValues()[opt.id] ?? []).includes(v.id))
        .map(v => ({
          optionId:      opt.id,
          optionName:    opt.name,
          valueId:       v.id,
          label:         v.label,
          priceDeltaHt:  v.priceDeltaHt,
          priceDeltaTtc: v.priceDeltaHt * (1 + this.product.vatRate / 100),
        }))
    );
    this.modalCtrl.dismiss({ selectedOptions }, 'confirm');
  }

  dismiss(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }
}
