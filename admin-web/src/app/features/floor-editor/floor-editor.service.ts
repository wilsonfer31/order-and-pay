import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';

export interface FloorPlan {
  id: string;
  name: string;
  gridCols: number;
  gridRows: number;
  backgroundUrl?: string;
}

export interface TableCell {
  id: string;
  label: string;
  capacity: number;
  /** Position dans la grille (0-indexed) */
  gridX: number;
  gridY: number;
  gridW: number;
  gridH: number;
  shape: 'RECT' | 'ROUND' | 'BAR';
  status: 'FREE' | 'OCCUPIED' | 'RESERVED' | 'DIRTY';
  qrToken?: string;
  /** État UI local (non sauvegardé) */
  isDragging?: boolean;
  isSelected?: boolean;
}

export interface GridCell {
  col: number;
  row: number;
  table: TableCell | null;
  isOccupied: boolean;
}

@Injectable({ providedIn: 'root' })
export class FloorEditorService {
  // ── Signals (Angular 17 réactif) ──────────────────────────────────────────
  readonly floorPlan   = signal<FloorPlan | null>(null);
  readonly tables      = signal<TableCell[]>([]);
  readonly selectedId  = signal<string | null>(null);
  readonly isDirty     = signal(false);

  readonly selectedTable = computed(() =>
    this.tables().find(t => t.id === this.selectedId()) ?? null
  );

  /** Grille 2D pour le rendu : tableau[row][col] */
  readonly grid = computed<GridCell[][]>(() => {
    const plan = this.floorPlan();
    if (!plan) return [];

    const grid: GridCell[][] = Array.from({ length: plan.gridRows }, (_, row) =>
      Array.from({ length: plan.gridCols }, (_, col) => ({
        col, row, table: null, isOccupied: false
      }))
    );

    for (const table of this.tables()) {
      // Marque toutes les cases occupées par cette table
      for (let r = table.gridY; r < table.gridY + table.gridH; r++) {
        for (let c = table.gridX; c < table.gridX + table.gridW; c++) {
          if (grid[r]?.[c]) {
            grid[r][c].isOccupied = true;
            // Seule la case "origine" porte la référence table
            if (r === table.gridY && c === table.gridX) {
              grid[r][c].table = table;
            }
          }
        }
      }
    }
    return grid;
  });

  constructor(private http: HttpClient) {}

  // ── Chargement ─────────────────────────────────────────────────────────────

  loadFloorPlan(floorPlanId: string): Observable<FloorPlan> {
    const req$ = floorPlanId === 'default'
      ? this.http.get<FloorPlan[]>('/floor-plans').pipe(map(plans => plans[0]))
      : this.http.get<FloorPlan>(`/floor-plans/${floorPlanId}`);
    return req$.pipe(tap(plan => this.floorPlan.set(plan)));
  }

  loadTables(floorPlanId: string): Observable<TableCell[]> {
    return this.http.get<TableCell[]>(`/floor-plans/${floorPlanId}/tables`).pipe(
      tap(tables => {
        this.tables.set(tables);
        this.isDirty.set(false);
      })
    );
  }

  // ── Drag & Drop ────────────────────────────────────────────────────────────

  /**
   * Appelé par le composant quand l'utilisateur dépose une table sur une cellule.
   * Vérifie les collisions avant d'accepter le déplacement.
   */
  moveTable(tableId: string, toCol: number, toRow: number): boolean {
    const table = this.tables().find(t => t.id === tableId);
    if (!table) return false;

    const plan = this.floorPlan()!;
    // Vérification des limites de la grille
    if (toCol + table.gridW > plan.gridCols) return false;
    if (toRow + table.gridH > plan.gridRows) return false;

    // Vérification de collision avec d'autres tables
    const conflict = this.tables().some(other => {
      if (other.id === tableId) return false;
      return this.overlaps(
        toCol, toRow, table.gridW, table.gridH,
        other.gridX, other.gridY, other.gridW, other.gridH
      );
    });
    if (conflict) return false;

    this.tables.update(tables =>
      tables.map(t => t.id === tableId
        ? { ...t, gridX: toCol, gridY: toRow }
        : t
      )
    );
    this.isDirty.set(true);
    return true;
  }

  resizeTable(tableId: string, newW: number, newH: number): boolean {
    const table = this.tables().find(t => t.id === tableId);
    if (!table) return false;

    const plan = this.floorPlan()!;
    if (table.gridX + newW > plan.gridCols) return false;
    if (table.gridY + newH > plan.gridRows) return false;

    const conflict = this.tables().some(other => {
      if (other.id === tableId) return false;
      return this.overlaps(
        table.gridX, table.gridY, newW, newH,
        other.gridX, other.gridY, other.gridW, other.gridH
      );
    });
    if (conflict) return false;

    this.tables.update(tables =>
      tables.map(t => t.id === tableId ? { ...t, gridW: newW, gridH: newH } : t)
    );
    this.isDirty.set(true);
    return true;
  }

  // ── CRUD local ─────────────────────────────────────────────────────────────

  addTable(label: string, col = 0, row = 0): void {
    const newTable: TableCell = {
      id: `new-${Date.now()}`,  // ID temporaire
      label,
      capacity: 4,
      gridX: col, gridY: row,
      gridW: 1,   gridH: 1,
      shape: 'RECT',
      status: 'FREE'
    };
    this.tables.update(t => [...t, newTable]);
    this.selectedId.set(newTable.id);
    this.isDirty.set(true);
  }

  updateTableProps(tableId: string, props: Partial<TableCell>): void {
    this.tables.update(tables =>
      tables.map(t => t.id === tableId ? { ...t, ...props } : t)
    );
    this.isDirty.set(true);
  }

  deleteTable(tableId: string): void {
    this.tables.update(t => t.filter(table => table.id !== tableId));
    if (this.selectedId() === tableId) this.selectedId.set(null);
    this.isDirty.set(true);
  }

  selectTable(id: string | null): void {
    this.selectedId.set(id);
  }

  // ── Persistance ────────────────────────────────────────────────────────────

  save(floorPlanId: string): Observable<void> {
    const positions = this.tables().map(t => ({
      tableId: t.id,
      x: t.gridX, y: t.gridY,
      w: t.gridW, h: t.gridH
    }));

    return this.http
      .put<void>(`/floor-plans/${floorPlanId}/tables/positions`, positions)
      .pipe(tap(() => this.isDirty.set(false)));
  }

  // ── Utilitaires ────────────────────────────────────────────────────────────

  private overlaps(ax: number, ay: number, aw: number, ah: number,
                   bx: number, by: number, bw: number, bh: number): boolean {
    return ax < bx + bw && ax + aw > bx &&
           ay < by + bh && ay + ah > by;
  }
}
