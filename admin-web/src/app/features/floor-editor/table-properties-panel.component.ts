import {
  Component, Input, Output, EventEmitter,
  ChangeDetectionStrategy, OnChanges
} from '@angular/core';
import { CommonModule }       from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule }     from '@angular/material/input';
import { MatSelectModule }    from '@angular/material/select';
import { MatButtonModule }    from '@angular/material/button';
import { MatIconModule }      from '@angular/material/icon';
import { TableCell }          from './floor-editor.service';

@Component({
  selector: 'app-table-properties-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
<aside class="props-panel">
  <div class="props-panel__header">
    <span>Propriétés — {{ table.label }}</span>
    <button mat-icon-button color="warn" (click)="deleteTable.emit(table.id)"
            title="Supprimer la table">
      <mat-icon>delete</mat-icon>
    </button>
  </div>

  <form [formGroup]="form" class="props-panel__form" (ngSubmit)="apply()">

    <mat-form-field appearance="outline">
      <mat-label>Label</mat-label>
      <input matInput formControlName="label" maxlength="20" />
    </mat-form-field>

    <mat-form-field appearance="outline">
      <mat-label>Capacité</mat-label>
      <input matInput type="number" formControlName="capacity" min="1" max="50" />
    </mat-form-field>

    <mat-form-field appearance="outline">
      <mat-label>Forme</mat-label>
      <mat-select formControlName="shape">
        <mat-option value="RECT">Rectangle</mat-option>
        <mat-option value="ROUND">Rond</mat-option>
        <mat-option value="BAR">Bar / Comptoir</mat-option>
      </mat-select>
    </mat-form-field>

    <mat-form-field appearance="outline">
      <mat-label>Largeur (cases)</mat-label>
      <input matInput type="number" formControlName="gridW" min="1" max="6" />
    </mat-form-field>

    <mat-form-field appearance="outline">
      <mat-label>Hauteur (cases)</mat-label>
      <input matInput type="number" formControlName="gridH" min="1" max="6" />
    </mat-form-field>

    <button mat-flat-button color="primary" type="submit"
            [disabled]="form.invalid">
      Appliquer
    </button>
  </form>
</aside>
  `,
  styles: [`
    .props-panel {
      width: 260px;
      background: white;
      border-left: 1px solid #e0e0e0;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }
    .props-panel__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      font-weight: 600;
      border-bottom: 1px solid #e0e0e0;
    }
    .props-panel__form {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
    }
  `]
})
export class TablePropertiesPanelComponent implements OnChanges {
  @Input({ required: true }) table!: TableCell;
  @Output() tableChange = new EventEmitter<Partial<TableCell> & { id: string }>();
  @Output() deleteTable = new EventEmitter<string>();

  form!: FormGroup;
  private currentTableId: string | null = null;

  constructor(private fb: FormBuilder) {}

  ngOnChanges(): void {
    if (!this.form || this.table.id !== this.currentTableId) {
      // Nouvelle table sélectionnée → recréer le formulaire
      this.currentTableId = this.table.id;
      this.form = this.fb.group({
        label:    [this.table.label,    [Validators.required, Validators.maxLength(20)]],
        capacity: [this.table.capacity, [Validators.required, Validators.min(1), Validators.max(50)]],
        shape:    [this.table.shape,    Validators.required],
        gridW:    [this.table.gridW,    [Validators.required, Validators.min(1), Validators.max(6)]],
        gridH:    [this.table.gridH,    [Validators.required, Validators.min(1), Validators.max(6)]],
      });
    } else {
      // Même table mise à jour (après apply) → patcher sans perdre l'état
      this.form.patchValue({
        label:    this.table.label,
        capacity: this.table.capacity,
        shape:    this.table.shape,
        gridW:    this.table.gridW,
        gridH:    this.table.gridH,
      }, { emitEvent: false });
    }
  }

  apply(): void {
    if (this.form.valid) {
      this.tableChange.emit({ id: this.table.id, ...this.form.value });
      this.form.markAsPristine();
    }
  }
}
