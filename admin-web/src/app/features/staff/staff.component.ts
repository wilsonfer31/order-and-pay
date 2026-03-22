import { Component, OnInit, signal, computed, inject, effect } from '@angular/core';
import { CommonModule }          from '@angular/common';
import { HttpClient }            from '@angular/common/http';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatButtonModule }       from '@angular/material/button';
import { MatIconModule }         from '@angular/material/icon';
import { MatFormFieldModule }    from '@angular/material/form-field';
import { MatInputModule }        from '@angular/material/input';
import { MatSelectModule }       from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule }      from '@angular/material/tooltip';
import { MatDialog }             from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { getPagesForRole, NavPage } from '../../core/role-permissions';

interface StaffMember {
  id:          string;
  email:       string;
  firstName:   string | null;
  lastName:    string | null;
  role:        string;
  active:      boolean;
  lastLoginAt: string | null;
  createdAt:   string;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER:   'Propriétaire',
  MANAGER: 'Manager',
  WAITER:  'Serveur',
  KITCHEN: 'Cuisine',
  CASHIER: 'Caissier',
};

const ROLE_COLORS: Record<string, string> = {
  OWNER:   '#7c3aed',
  MANAGER: '#2563eb',
  WAITER:  '#0891b2',
  KITCHEN: '#d97706',
  CASHIER: '#16a34a',
};

@Component({
  selector: 'app-staff',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatSnackBarModule, MatTooltipModule,
  ],
  template: `
<div class="staff-page">

  <!-- En-tête ---------------------------------------------------------------->
  <div class="page-header">
    <div class="page-header__left">
      <mat-icon>people</mat-icon>
      <h1>Équipe</h1>
      <span class="count-badge">{{ staff().length }} membre{{ staff().length > 1 ? 's' : '' }}</span>
    </div>
    <button mat-flat-button color="primary" (click)="openNew()">
      <mat-icon>person_add</mat-icon>
      Ajouter un membre
    </button>
  </div>

  <!-- Layout ----------------------------------------------------------------->
  <div class="layout" [class.layout--with-panel]="panelOpen()">

    <!-- Liste ---------------------------------------------------------------->
    <div class="list-section">
      @if (loading()) {
        <div class="empty-state"><mat-icon class="spin">refresh</mat-icon> Chargement…</div>
      } @else if (staff().length === 0) {
        <div class="empty-state">
          <mat-icon>group_off</mat-icon>
          <p>Aucun membre dans l'équipe.</p>
        </div>
      } @else {
        <div class="staff-table">
          <div class="staff-table__header">
            <span>Membre</span>
            <span>Rôle</span>
            <span>Statut</span>
            <span>Dernière connexion</span>
            <span></span>
          </div>
          @for (m of staff(); track m.id) {
            <div class="staff-row"
                 [class.staff-row--inactive]="!m.active"
                 [class.staff-row--selected]="editing()?.id === m.id"
                 (click)="openEdit(m)">
              <div class="staff-row__identity">
                <div class="avatar" [style.background]="roleColor(m.role)">
                  {{ initials(m) }}
                </div>
                <div>
                  <div class="staff-row__name">{{ fullName(m) }}</div>
                  <div class="staff-row__email">{{ m.email }}</div>
                </div>
              </div>
              <div>
                <span class="role-badge" [style.background]="roleColor(m.role) + '1a'" [style.color]="roleColor(m.role)">
                  {{ roleLabel(m.role) }}
                </span>
              </div>
              <div>
                <span class="status-badge" [class.status-badge--active]="m.active" [class.status-badge--inactive]="!m.active">
                  {{ m.active ? 'Actif' : 'Désactivé' }}
                </span>
              </div>
              <div class="staff-row__login">
                {{ m.lastLoginAt ? (m.lastLoginAt | date:'dd/MM/yyyy HH:mm':'':'fr') : '—' }}
              </div>
              <div class="staff-row__actions" (click)="$event.stopPropagation()">
                <button mat-icon-button
                        [matTooltip]="m.active ? 'Désactiver' : 'Réactiver'"
                        (click)="toggleActive(m)">
                  <mat-icon>{{ m.active ? 'person_off' : 'person' }}</mat-icon>
                </button>
                <button mat-icon-button color="warn" matTooltip="Supprimer" (click)="deleteMember(m)">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- Panneau formulaire --------------------------------------------------->
    @if (panelOpen()) {
      <div class="panel">
        <div class="panel__header">
          <h2>{{ editing() ? 'Modifier le membre' : 'Nouveau membre' }}</h2>
          <button mat-icon-button (click)="closePanel()"><mat-icon>close</mat-icon></button>
        </div>

        <form [formGroup]="form" (ngSubmit)="save()" class="panel__form">

          <div class="form-row">
            <mat-form-field appearance="outline">
              <mat-label>Prénom</mat-label>
              <input matInput formControlName="firstName" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Nom</mat-label>
              <input matInput formControlName="lastName" />
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline">
            <mat-label>Email</mat-label>
            <input matInput type="email" formControlName="email" [readonly]="!!editing()" />
            @if (form.get('email')?.hasError('email')) {
              <mat-error>Email invalide</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Rôle</mat-label>
            <mat-select formControlName="role">
              @for (r of roles; track r.value) {
                <mat-option [value]="r.value">{{ r.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>{{ editing() ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe' }}</mat-label>
            <input matInput type="password" formControlName="password" autocomplete="new-password" />
            @if (form.get('password')?.hasError('minlength')) {
              <mat-error>8 caractères minimum</mat-error>
            }
          </mat-form-field>

          <!-- Accès accordés selon le rôle -->
          @if (roleAccess().length > 0) {
            <div class="access-preview">
              <span class="access-preview__label">Accès accordés</span>
              <div class="access-preview__chips">
                @for (page of roleAccess(); track page.route) {
                  <span class="access-chip">
                    <mat-icon>{{ page.icon }}</mat-icon>
                    {{ page.label }}
                  </span>
                }
              </div>
            </div>
          }

          <div class="panel__actions">
            <button mat-button type="button" (click)="closePanel()">Annuler</button>
            <button mat-flat-button color="primary" type="submit" [disabled]="saving()">
              {{ saving() ? 'Enregistrement…' : (editing() ? 'Enregistrer' : 'Créer') }}
            </button>
          </div>

          @if (error()) {
            <p class="form-error">{{ error() }}</p>
          }

        </form>
      </div>
    }

  </div>
</div>
  `,
  styles: [`
    .staff-page { padding: 32px; max-width: 1100px; margin: 0 auto; }

    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .page-header__left { display: flex; align-items: center; gap: 10px; }
    .page-header__left mat-icon { color: #2563eb; font-size: 28px; width: 28px; height: 28px; }
    .page-header__left h1 { margin: 0; font-size: 22px; font-weight: 700; color: #111827; }

    .count-badge { background: #eff6ff; color: #2563eb; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 99px; }

    .layout { display: grid; grid-template-columns: 1fr; gap: 24px; }
    .layout--with-panel { grid-template-columns: 1fr 360px; }

    .staff-table { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
    .staff-table__header {
      display: grid; grid-template-columns: 2fr 1fr 1fr 1.5fr 80px;
      padding: 10px 16px; background: #f9fafb; border-bottom: 1px solid #e5e7eb;
      font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #6b7280;
    }

    .staff-row {
      display: grid; grid-template-columns: 2fr 1fr 1fr 1.5fr 80px;
      align-items: center; padding: 12px 16px;
      border-bottom: 1px solid #f3f4f6; cursor: pointer; transition: background .1s;
    }
    .staff-row:last-child { border-bottom: none; }
    .staff-row:hover { background: #f9fafb; }
    .staff-row--selected { background: #eff6ff !important; }
    .staff-row--inactive { opacity: .55; }
    .staff-row__identity { display: flex; align-items: center; gap: 10px; }
    .staff-row__name { font-weight: 600; font-size: 14px; color: #111827; }
    .staff-row__email { font-size: 12px; color: #6b7280; }
    .staff-row__login { font-size: 12px; color: #6b7280; }
    .staff-row__actions { display: flex; gap: 2px; justify-content: flex-end; }

    .avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: white; flex-shrink: 0; }

    .role-badge { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 99px; white-space: nowrap; }

    .status-badge { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 99px; }
    .status-badge--active   { background: #dcfce7; color: #16a34a; }
    .status-badge--inactive { background: #f3f4f6; color: #6b7280; }

    .panel { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; height: fit-content; }
    .panel__header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #e5e7eb; }
    .panel__header h2 { margin: 0; font-size: 16px; font-weight: 700; color: #111827; }
    .panel__form { padding: 20px; display: flex; flex-direction: column; gap: 4px; }
    .panel__form mat-form-field { width: 100%; }
    .panel__actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }

    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .form-error { color: #dc2626; font-size: 13px; margin: 0; text-align: center; }

    .empty-state { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 48px; color: #9ca3af; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; }
    .empty-state mat-icon { font-size: 40px; width: 40px; height: 40px; }
    .empty-state p { margin: 0; font-size: 14px; }

    .access-preview { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; margin: 4px 0; }
    .access-preview__label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #16a34a; display: block; margin-bottom: 8px; }
    .access-preview__chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .access-chip { display: inline-flex; align-items: center; gap: 4px; background: #fff; border: 1px solid #bbf7d0; border-radius: 99px; padding: 3px 10px; font-size: 12px; font-weight: 500; color: #166534; }
    .access-chip mat-icon { font-size: 14px; width: 14px; height: 14px; }

    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class StaffComponent implements OnInit {

  private http   = inject(HttpClient);
  private snack  = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private fb     = inject(FormBuilder);

  staff     = signal<StaffMember[]>([]);
  loading   = signal(true);
  saving    = signal(false);
  error     = signal<string | null>(null);
  editing   = signal<StaffMember | null>(null);
  panelOpen = signal(false);
  selectedRole = signal<string>('WAITER');

  readonly roleAccess = computed<NavPage[]>(() => getPagesForRole(this.selectedRole()));

  readonly roles = [
    { value: 'OWNER',   label: 'Propriétaire' },
    { value: 'MANAGER', label: 'Manager' },
    { value: 'WAITER',  label: 'Serveur' },
    { value: 'KITCHEN', label: 'Cuisine' },
    { value: 'CASHIER', label: 'Caissier' },
  ];

  form = this.fb.group({
    firstName: [''],
    lastName:  [''],
    email:     ['', [Validators.required, Validators.email]],
    role:      ['WAITER', Validators.required],
    password:  ['', [Validators.minLength(8)]],
  });

  ngOnInit(): void {
    this.load();
    this.form.get('role')!.valueChanges.subscribe(r => {
      if (r) this.selectedRole.set(r);
    });
  }

  private load(): void {
    this.loading.set(true);
    this.http.get<StaffMember[]>('/staff').subscribe({
      next: data => { this.staff.set(data); this.loading.set(false); },
      error: ()   => this.loading.set(false),
    });
  }

  openNew(): void {
    this.editing.set(null);
    this.form.reset({ role: 'WAITER' });
    this.selectedRole.set('WAITER');
    this.form.get('email')!.enable();
    this.form.get('password')!.setValidators([Validators.required, Validators.minLength(8)]);
    this.form.get('password')!.updateValueAndValidity();
    this.error.set(null);
    this.panelOpen.set(true);
  }

  openEdit(m: StaffMember): void {
    this.editing.set(m);
    this.form.reset({
      firstName: m.firstName ?? '',
      lastName:  m.lastName  ?? '',
      email:     m.email,
      role:      m.role,
      password:  '',
    });
    this.selectedRole.set(m.role);
    this.form.get('email')!.disable();
    this.form.get('password')!.setValidators([Validators.minLength(8)]);
    this.form.get('password')!.updateValueAndValidity();
    this.error.set(null);
    this.panelOpen.set(true);
  }

  closePanel(): void {
    this.panelOpen.set(false);
    this.editing.set(null);
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.error.set(null);
    const v = this.form.getRawValue();

    if (this.editing()) {
      const body: any = { firstName: v.firstName, lastName: v.lastName, role: v.role };
      if (v.password) body.password = v.password;
      this.http.put<StaffMember>(`/staff/${this.editing()!.id}`, body).subscribe({
        next: updated => {
          this.staff.update(list => list.map(m => m.id === updated.id ? updated : m));
          this.saving.set(false);
          this.closePanel();
          this.snack.open('Membre mis à jour', '', { duration: 2500 });
        },
        error: err => { this.saving.set(false); this.error.set(err?.error?.message ?? 'Erreur lors de la sauvegarde'); }
      });
    } else {
      this.http.post<StaffMember>('/staff', v).subscribe({
        next: created => {
          this.staff.update(list => [...list, created]);
          this.saving.set(false);
          this.closePanel();
          this.snack.open('Membre créé', '', { duration: 2500 });
        },
        error: err => { this.saving.set(false); this.error.set(err?.error?.message ?? 'Erreur lors de la création'); }
      });
    }
  }

  toggleActive(m: StaffMember): void {
    const action = m.active ? 'désactiver' : 'réactiver';
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: m.active ? 'Désactiver le membre' : 'Réactiver le membre',
        message: `Voulez-vous ${action} ${this.fullName(m) || m.email} ?`,
        confirmLabel: m.active ? 'Désactiver' : 'Réactiver',
        danger: m.active,
      }
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.http.patch<StaffMember>(`/staff/${m.id}/active`, {}).subscribe({
        next: updated => {
          this.staff.update(list => list.map(x => x.id === updated.id ? updated : x));
          if (this.editing()?.id === m.id) this.editing.set(updated);
          this.snack.open(updated.active ? 'Membre réactivé' : 'Membre désactivé', '', { duration: 2500 });
        },
        error: () => this.snack.open('Erreur', 'Fermer', { duration: 3000 })
      });
    });
  }

  deleteMember(m: StaffMember): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Supprimer le membre',
        message: `Supprimer définitivement ${this.fullName(m) || m.email} ? Cette action est irréversible.`,
        confirmLabel: 'Supprimer',
        danger: true,
      }
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.http.delete(`/staff/${m.id}`).subscribe({
        next: () => {
          this.staff.update(list => list.filter(x => x.id !== m.id));
          if (this.editing()?.id === m.id) this.closePanel();
          this.snack.open('Membre supprimé', '', { duration: 2500 });
        },
        error: () => this.snack.open('Erreur lors de la suppression', 'Fermer', { duration: 3000 })
      });
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  fullName(m: StaffMember): string {
    return [m.firstName, m.lastName].filter(Boolean).join(' ');
  }

  initials(m: StaffMember): string {
    const f = m.firstName?.[0] ?? '';
    const l = m.lastName?.[0]  ?? '';
    return (f + l).toUpperCase() || m.email[0].toUpperCase();
  }

  roleLabel(role: string): string { return ROLE_LABELS[role] ?? role; }
  roleColor(role: string): string { return ROLE_COLORS[role] ?? '#6b7280'; }
}
