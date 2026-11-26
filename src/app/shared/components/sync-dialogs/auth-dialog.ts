import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { SupabaseAuthService } from '../../../core/services/supabase-auth.service';

export type AuthDialogMode = 'login' | 'reset' | 'set_password';

export interface AuthDialogData {
  initialMode?: AuthDialogMode;
}

export interface AuthDialogResult {
  authenticated?: boolean;
  passwordUpdated?: boolean;
}

@Component({
  selector: 'app-auth-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <div class="p-6">
      <div class="mb-5 flex items-start justify-between gap-3">
        <div class="flex items-center gap-3">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 dark:bg-cyan-950/70 dark:text-cyan-300">
            <mat-icon>{{ mode() === 'set_password' ? 'vpn_key' : 'cloud_sync' }}</mat-icon>
          </div>
          <div>
            <h2 class="text-lg font-bold text-slate-900 dark:text-white">
              @switch (mode()) {
                @case ('login') {
                  Sincronización en la nube
                }
                @case ('reset') {
                  Recuperar contraseña
                }
                @case ('set_password') {
                  Establecer contraseña
                }
              }
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              @switch (mode()) {
                @case ('login') {
                  Acceso por invitación · Tus datos siguen funcionando 100 % offline
                }
                @case ('reset') {
                  Te enviaremos un enlace de recuperación a tu correo
                }
                @case ('set_password') {
                  Elige una contraseña para activar tu cuenta sincronizada
                }
              }
            </p>
          </div>
        </div>
        <button mat-icon-button type="button" (click)="close()" aria-label="Cerrar">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      @if (errorMessage()) {
        <div
          class="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
          <mat-icon class="!h-4 !w-4 shrink-0 !text-[16px]">error_outline</mat-icon>
          <span>{{ errorMessage() }}</span>
        </div>
      }

      @if (infoMessage()) {
        <div
          class="mb-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
          <mat-icon class="!h-4 !w-4 shrink-0 !text-[16px]">check_circle_outline</mat-icon>
          <span>{{ infoMessage() }}</span>
        </div>
      }

      @if (mode() === 'login') {
        <form (ngSubmit)="submitLogin()" class="space-y-4">
          <div>
            <label for="auth-email" class="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Correo electrónico
            </label>
            <input
              id="auth-email"
              type="email"
              name="email"
              [(ngModel)]="email"
              required
              autocomplete="email"
              placeholder="tu@correo.com"
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label for="auth-password" class="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Contraseña
            </label>
            <input
              id="auth-password"
              type="password"
              name="password"
              [(ngModel)]="password"
              required
              autocomplete="current-password"
              placeholder="••••••••"
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div class="flex items-center justify-between pt-1">
            <button
              type="button"
              (click)="switchMode('reset')"
              class="text-xs font-medium text-cyan-600 hover:underline dark:text-cyan-400">
              ¿Olvidaste o aún no tienes contraseña?
            </button>

            <button
              mat-flat-button
              color="primary"
              type="submit"
              [disabled]="auth.loading() || !email.trim() || !password"
              class="!rounded-xl">
              {{ auth.loading() ? 'Entrando...' : 'Iniciar sesión' }}
            </button>
          </div>
        </form>
      } @else if (mode() === 'reset') {
        <form (ngSubmit)="submitReset()" class="space-y-4">
          <div>
            <label for="reset-email" class="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Correo electrónico
            </label>
            <input
              id="reset-email"
              type="email"
              name="resetEmail"
              [(ngModel)]="email"
              required
              autocomplete="email"
              placeholder="tu@correo.com"
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div class="flex items-center justify-between pt-1">
            <button
              type="button"
              (click)="switchMode('login')"
              class="text-xs font-medium text-slate-500 hover:underline dark:text-slate-400">
              Volver a iniciar sesión
            </button>

            <button
              mat-flat-button
              color="primary"
              type="submit"
              [disabled]="auth.loading() || !email.trim()"
              class="!rounded-xl">
              {{ auth.loading() ? 'Enviando...' : 'Enviar enlace' }}
            </button>
          </div>
        </form>
      } @else {
        <form (ngSubmit)="submitNewPassword()" class="space-y-4">
          <div>
            <label for="new-password" class="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Nueva contraseña (mínimo 6 caracteres)
            </label>
            <input
              id="new-password"
              type="password"
              name="newPassword"
              [(ngModel)]="newPassword"
              required
              minlength="6"
              autocomplete="new-password"
              placeholder="••••••••"
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label for="confirm-password" class="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Repetir contraseña
            </label>
            <input
              id="confirm-password"
              type="password"
              name="confirmPassword"
              [(ngModel)]="confirmPassword"
              required
              minlength="6"
              autocomplete="new-password"
              placeholder="••••••••"
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div class="flex justify-end gap-2 pt-1">
            <button mat-stroked-button type="button" (click)="close()" class="!rounded-xl">
              Más tarde
            </button>
            <button
              mat-flat-button
              color="primary"
              type="submit"
              [disabled]="auth.loading() || newPassword.length < 6"
              class="!rounded-xl">
              {{ auth.loading() ? 'Guardando...' : 'Guardar contraseña' }}
            </button>
          </div>
        </form>
      }
    </div>
  `,
})
export class AuthDialog {
  protected readonly auth = inject(SupabaseAuthService);
  private readonly dialogRef = inject(MatDialogRef<AuthDialog, AuthDialogResult>);
  private readonly data = inject<AuthDialogData | null>(MAT_DIALOG_DATA, { optional: true });

  protected readonly mode = signal<AuthDialogMode>(this.data?.initialMode ?? 'login');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly infoMessage = signal<string | null>(null);

  protected email = '';
  protected password = '';
  protected newPassword = '';
  protected confirmPassword = '';

  protected switchMode(next: AuthDialogMode): void {
    this.mode.set(next);
    this.errorMessage.set(null);
    this.infoMessage.set(null);
  }

  protected close(): void {
    if (this.mode() === 'set_password') {
      this.auth.dismissPasswordSetup();
    }
    this.dialogRef.close();
  }

  protected async submitLogin(): Promise<void> {
    this.errorMessage.set(null);
    this.infoMessage.set(null);
    const { error } = await this.auth.signInWithPassword(this.email, this.password);
    if (error) {
      this.errorMessage.set(error);
      return;
    }
    this.dialogRef.close({ authenticated: true });
  }

  protected async submitReset(): Promise<void> {
    this.errorMessage.set(null);
    this.infoMessage.set(null);
    const { error } = await this.auth.sendPasswordResetEmail(this.email);
    if (error) {
      this.errorMessage.set(error);
      return;
    }
    this.infoMessage.set(
      'Si tu correo está dado de alta, recibirás un enlace para restablecer la contraseña.',
    );
  }

  protected async submitNewPassword(): Promise<void> {
    this.errorMessage.set(null);
    this.infoMessage.set(null);
    if (this.newPassword.length < 6) {
      this.errorMessage.set('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage.set('Las contraseñas no coinciden.');
      return;
    }

    const { error } = await this.auth.updatePassword(this.newPassword);
    if (error) {
      this.errorMessage.set(error);
      return;
    }
    this.dialogRef.close({ passwordUpdated: true, authenticated: true });
  }
}
