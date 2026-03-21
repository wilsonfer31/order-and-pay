import {
  Component, OnInit, OnDestroy, HostListener,
  ChangeDetectionStrategy, inject
} from '@angular/core';
import { CommonModule }    from '@angular/common';
import { ActivatedRoute }  from '@angular/router';
import { HttpClient }      from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule }   from '@angular/material/icon';
import { MatSnackBar }     from '@angular/material/snack-bar';
import { Subject, switchMap, takeUntil } from 'rxjs';

import { FloorEditorService, TableCell, GridCell } from './floor-editor.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { AuthService } from '../../core/services/auth.service';
// TableCell and GridCell used in template and markClean method
import { TablePropertiesPanelComponent }            from './table-properties-panel.component';

@Component({
  selector: 'app-floor-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    TablePropertiesPanelComponent,
  ],
  template: `
<div class="floor-editor-layout">

  <!-- Barre d'outils -->
  <div class="toolbar">
    <span class="toolbar__title">
      Éditeur de salle — {{ service.floorPlan()?.name }}
    </span>
    <button mat-stroked-button (click)="addTable()">
      <mat-icon>add</mat-icon> Ajouter table
    </button>
    <button mat-flat-button color="primary"
            [disabled]="!service.isDirty()"
            (click)="save()">
      <mat-icon>save</mat-icon> Sauvegarder
    </button>
  </div>

  <div class="editor-body">

    <!-- Grille drag & drop -->
    <div class="grid-container"
         [style.--cols]="service.floorPlan()?.gridCols"
         [style.--rows]="service.floorPlan()?.gridRows">

      @for (row of service.grid(); track $index) {
        @for (cell of row; track $index) {
          <!-- Cellule vide = zone de drop ou clic pour placer -->
          @if (!cell.isOccupied) {
            <div class="grid-cell grid-cell--empty"
                 [attr.data-col]="cell.col"
                 [attr.data-row]="cell.row"
                 (dragover)="onDragOver($event)"
                 (drop)="onDrop($event, cell)"
                 (click)="onEmptyCellClick(cell)"
                 title="Cliquer pour ajouter une table ici">
            </div>
          }

          <!-- Cellule avec table -->
          @if (cell.table) {
            <div class="grid-cell grid-cell--table"
                 [class.grid-cell--selected]="cell.table.id === service.selectedId()"
                 [class.grid-cell--round]="cell.table.shape === 'ROUND'"
                 [class.status--free]="cell.table.status === 'FREE'"
                 [class.status--occupied]="cell.table.status === 'OCCUPIED'"
                 [class.status--reserved]="cell.table.status === 'RESERVED'"
                 [class.status--dirty]="cell.table.status === 'DIRTY'"
                 [style.grid-column]="cell.col + 1 + ' / span ' + cell.table.gridW"
                 [style.grid-row]="cell.row + 1 + ' / span ' + cell.table.gridH"
                 draggable="true"
                 (dragstart)="onDragStart($event, cell.table)"
                 (click)="service.selectTable(cell.table.id)">
              <span class="table-label">{{ cell.table.label }}</span>
              <span class="table-capacity">
                <mat-icon style="font-size:12px">people</mat-icon>
                {{ cell.table.capacity }}
              </span>
              @if (cell.table.status === 'DIRTY') {
                <button class="clean-btn" title="Marquer comme propre"
                        (click)="$event.stopPropagation(); markClean(cell.table)">
                  <mat-icon style="font-size:14px">cleaning_services</mat-icon>
                  Propre
                </button>
              }
              @if (cell.table.status === 'OCCUPIED') {
                <button class="release-btn" title="Libérer la table"
                        (click)="$event.stopPropagation(); releaseTable(cell.table)">
                  <mat-icon style="font-size:14px">lock_open</mat-icon>
                  Libérer
                </button>
              }
            </div>
          }
        }
      }
    </div>

    <!-- Panneau propriétés -->
    @if (service.selectedTable()) {
      <app-table-properties-panel
        [table]="service.selectedTable()!"
        (tableChange)="onTableChange($event)"
        (deleteTable)="onDeleteTable($event)">
      </app-table-properties-panel>
    }
  </div>

</div>
  `,
  styles: [`
    .floor-editor-layout {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: #f5f5f5;
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 20px;
      background: white;
      border-bottom: 1px solid #e0e0e0;
      box-shadow: 0 2px 4px rgba(0,0,0,.08);
    }
    .toolbar__title { flex: 1; font-weight: 600; font-size: 16px; }

    .editor-body {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    .grid-container {
      flex: 1;
      display: grid;
      grid-template-columns: repeat(var(--cols, 12), 1fr);
      grid-template-rows:    repeat(var(--rows, 8), 1fr);
      gap: 4px;
      padding: 20px;
      overflow: auto;
    }

    .grid-cell {
      border-radius: 6px;
      min-height: 60px;
      cursor: pointer;
      transition: all .15s ease;
    }

    .grid-cell--empty {
      background: rgba(0,0,0,.04);
      border: 1px dashed #ccc;
      &:hover { background: rgba(63,81,181,.08); border-color: #3f51b5; }
    }

    .grid-cell--table {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 13px;
      cursor: grab;
      border: 2px solid transparent;
      &:active { cursor: grabbing; }
    }
    .grid-cell--round { border-radius: 50%; }
    .grid-cell--selected { border-color: #3f51b5 !important; box-shadow: 0 0 0 3px rgba(63,81,181,.3); }

    /* Statuts couleurs */
    .status--free     { background: #e8f5e9; color: #2e7d32; }
    .status--occupied { background: #ffebee; color: #c62828; }
    .status--reserved { background: #fff8e1; color: #f57f17; }
    .status--dirty    { background: #f3e5f5; color: #6a1b9a; }

    .table-label    { font-size: 14px; font-weight: 700; }
    .table-capacity { font-size: 11px; opacity: .7; display: flex; align-items: center; }

    .clean-btn {
      margin-top: 4px; padding: 2px 6px;
      background: #4caf50; color: white; border: none;
      border-radius: 6px; font-size: 10px; font-weight: 700;
      cursor: pointer; display: flex; align-items: center; gap: 2px;
      &:hover { background: #388e3c; }
    }

    .release-btn {
      margin-top: 4px; padding: 2px 6px;
      background: #ef5350; color: white; border: none;
      border-radius: 6px; font-size: 10px; font-weight: 700;
      cursor: pointer; display: flex; align-items: center; gap: 2px;
      &:hover { background: #c62828; }
    }
  `]
})
export class FloorEditorComponent implements OnInit, OnDestroy {
  readonly service = inject(FloorEditorService);

  private route    = inject(ActivatedRoute);
  private http     = inject(HttpClient);
  private snackBar = inject(MatSnackBar);
  private ws       = inject(WebSocketService);
  private auth     = inject(AuthService);
  private destroy$ = new Subject<void>();
  private draggedTableId: string | null = null;

  ngOnInit(): void {
    this.route.params.pipe(
      takeUntil(this.destroy$),
      switchMap(params => this.service.loadFloorPlan(params['id']).pipe(
        switchMap(plan => this.service.loadTables(plan.id))
      ))
    ).subscribe();

    this.ws.connect();
    const restaurantId = this.auth.getRestaurantId();
    if (restaurantId) {
      this.ws.tablesEvents$(restaurantId)
        .pipe(takeUntil(this.destroy$))
        .subscribe(event => {
          if (event.eventType === 'TABLE_STATUS_CHANGED' && event.tableId && event.tableStatus) {
            this.service.updateTableProps(event.tableId, {
              status: event.tableStatus as TableCell['status']
            });
          }
        });
    }
  }

  addTable(): void {
    const label = `T${this.service.tables().length + 1}`;
    if (!this.service.addTable(label)) {
      this.snackBar.open('Plus de place disponible dans la grille', '', { duration: 2000 });
    }
  }

  onEmptyCellClick(cell: GridCell): void {
    // Ignore si on est en train de drag
    if (this.draggedTableId) return;
    const label = `T${this.service.tables().length + 1}`;
    this.service.addTable(label, cell.col, cell.row);
  }

  save(): void {
    const planId = this.service.floorPlan()!.id;
    this.service.save(planId).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.snackBar.open('Disposition sauvegardée', '', { duration: 2000 }),
      error: () => this.snackBar.open('Erreur lors de la sauvegarde', 'Fermer', { duration: 4000 })
    });
  }

  onTableChange(updated: Partial<TableCell> & { id: string }): void {
    this.service.updateTableProps(updated.id, updated);
  }

  onDeleteTable(id: string): void {
    if (id.startsWith('new-')) {
      // Table jamais sauvegardée — suppression locale uniquement
      this.service.deleteTable(id);
      return;
    }
    this.http.delete(`/floor-plans/tables/${id}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.service.deleteTable(id);
          this.snackBar.open('Table supprimée', '', { duration: 2000 });
        },
        error: () => this.snackBar.open('Erreur lors de la suppression', 'Fermer', { duration: 3000 })
      });
  }

  // ── Drag & Drop HTML5 ─────────────────────────────────────────────────────

  onDragStart(event: DragEvent, table: TableCell): void {
    this.draggedTableId = table.id;
    event.dataTransfer?.setData('text/plain', table.id);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  onDrop(event: DragEvent, cell: GridCell): void {
    event.preventDefault();
    if (!this.draggedTableId) return;

    const moved = this.service.moveTable(this.draggedTableId, cell.col, cell.row);
    if (!moved) {
      this.snackBar.open('Position invalide ou déjà occupée', '', { duration: 1500 });
    }
    this.draggedTableId = null;
  }

  markClean(table: TableCell): void {
    this.http.patch(`/floor-plans/tables/${table.id}/status`, null, { params: { status: 'FREE' } })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.service.updateTableProps(table.id, { status: 'FREE' });
          this.snackBar.open(`Table ${table.label} marquée propre`, '', { duration: 2000 });
        },
        error: () => this.snackBar.open('Erreur lors de la mise à jour', 'Fermer', { duration: 3000 })
      });
  }

  releaseTable(table: TableCell): void {
    this.http.patch(`/floor-plans/tables/${table.id}/status`, null, { params: { status: 'FREE' } })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.service.updateTableProps(table.id, { status: 'FREE' });
          this.snackBar.open(`Table ${table.label} libérée`, '', { duration: 2000 });
        },
        error: () => this.snackBar.open('Erreur lors de la libération', 'Fermer', { duration: 3000 })
      });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.service.selectTable(null);
  }

  ngOnDestroy(): void {
    this.ws.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
