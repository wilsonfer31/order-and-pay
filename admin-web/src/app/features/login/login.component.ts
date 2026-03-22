import { Component, signal } from '@angular/core';
import { CommonModule }       from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router }             from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule }     from '@angular/material/input';
import { MatButtonModule }    from '@angular/material/button';
import { MatIconModule }      from '@angular/material/icon';
import { AuthService }        from '../../core/services/auth.service';
import { ROLE_PAGES }         from '../../core/role-permissions';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule
  ],
  template: `
<div class="login-page">

  <div class="login-card">

    <!-- En-tête -->
    <div class="login-header">
      <div class="login-icon">
        <mat-icon>restaurant_menu</mat-icon>
      </div>
      <h1>Order & Pay</h1>
      <p>Connectez-vous à votre espace</p>
    </div>

    <!-- Formulaire -->
    <form [formGroup]="form" (ngSubmit)="login()" class="login-form">

      <mat-form-field appearance="outline" class="field">
        <mat-label>Adresse email</mat-label>
        <input matInput formControlName="email" type="email" autocomplete="email" />
        <mat-icon matSuffix>mail_outline</mat-icon>
      </mat-form-field>

      <mat-form-field appearance="outline" class="field">
        <mat-label>Mot de passe</mat-label>
        <input matInput formControlName="password"
               [type]="showPwd() ? 'text' : 'password'"
               autocomplete="current-password" />
        <button mat-icon-button matSuffix type="button" (click)="togglePwd()">
          <mat-icon>{{ showPwd() ? 'visibility_off' : 'visibility' }}</mat-icon>
        </button>
      </mat-form-field>

      @if (error()) {
        <div class="login-error">
          <mat-icon>error_outline</mat-icon>
          {{ error() }}
        </div>
      }

      <button mat-flat-button class="login-btn" type="submit"
              [disabled]="form.invalid || loading()">
        @if (loading()) { <mat-icon class="spin">refresh</mat-icon> }
        {{ loading() ? 'Connexion...' : 'Se connecter' }}
      </button>

    </form>

    <!-- Démo hint -->
    <div class="login-hint">
      <span>Compte démo :</span>
      <code>admin&#64;demo.fr</code> / <code>Admin123!</code>
    </div>

  </div>

</div>
  `,
  styles: [`
    .login-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f9fafb;
      padding: 24px;
    }

    .login-card {
      width: 100%;
      max-width: 400px;
      background: white;
      border-radius: 16px;
      border: 1px solid #e5e7eb;
      box-shadow: 0 4px 24px rgba(0,0,0,.06);
      padding: 40px 36px 32px;
    }

    .login-header {
      text-align: center;
      margin-bottom: 32px;
    }
    .login-icon {
      width: 52px;
      height: 52px;
      background: #2563eb;
      border-radius: 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
      mat-icon { color: white; font-size: 26px; width: 26px; height: 26px; }
    }
    .login-header h1 {
      margin: 0 0 6px;
      font-size: 22px;
      font-weight: 800;
      color: #111827;
    }
    .login-header p { margin: 0; color: #6b7280; font-size: 14px; }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .field { width: 100%; }

    .login-error {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 10px 14px;
      color: #dc2626;
      font-size: 13px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }

    .login-btn {
      margin-top: 8px;
      height: 44px;
      background: #2563eb !important;
      color: white !important;
      border-radius: 10px !important;
      font-weight: 600 !important;
      font-size: 15px !important;
      letter-spacing: .01em;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .login-btn:disabled { opacity: .6; }

    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .login-hint {
      margin-top: 24px;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      flex-wrap: wrap;
      code {
        background: #f3f4f6;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 12px;
        color: #374151;
      }
    }
  `]
})
export class LoginComponent {
  form = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['',              Validators.required],
  });
  loading = signal(false);
  error   = signal<string | null>(null);
  showPwd = signal(false);

  constructor(
    private fb:     FormBuilder,
    private auth:   AuthService,
    private router: Router
  ) {}

  togglePwd(): void { this.showPwd.update(v => !v); }

  login(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const { email, password } = this.form.value;
    this.auth.login(email!, password!).subscribe({
      next: (res) => {
        const landing = ROLE_PAGES[res.role]?.[0] ?? '/dashboard';
        this.router.navigate([landing]);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Email ou mot de passe incorrect.');
      }
    });
  }
}
