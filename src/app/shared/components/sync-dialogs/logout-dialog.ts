import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export type LogoutDialogResult = 'keep_local' | 'clear_local' | undefined;

@Component({
  selector: 'app-logout-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <div class="p-6">
      <div class="mb-4 flex items-start gap-3">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <mat-icon>logout</mat-icon>
        </div>
        <div>
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">Cerrar sesión</h2>
          <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            ¿Qué quieres hacer con los datos guardados localmente en este navegador?
          </p>
        </div>
      </div>

      <div class="space-y-2">
        <button
          type="button"
          (click)="choose('keep_local')"
          class="flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
          <mat-icon class="mt-0.5 text-cyan-600 dark:text-cyan-400">laptop_mac</mat-icon>
          <div>
            <div class="text-sm font-semibold text-slate-900 dark:text-white">
              Mantener copia local offline
            </div>
            <div class="text-xs text-slate-500 dark:text-slate-400">
              Desconecta la cuenta pero conserva tus apuntes en este dispositivo en modo local.
            </div>
          </div>
        </button>

        <button
          type="button"
          (click)="choose('clear_local')"
          class="flex w-full items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/50 p-3 text-left transition hover:bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/20 dark:hover:bg-rose-950/40">
          <mat-icon class="mt-0.5 text-rose-600 dark:text-rose-400">delete_sweep</mat-icon>
          <div>
            <div class="text-sm font-semibold text-rose-700 dark:text-rose-300">
              Borrar datos locales de este dispositivo
            </div>
            <div class="text-xs text-rose-600/80 dark:text-rose-300/80">
              Recomendado en equipos compartidos. Tus datos en la nube permanecen intactos.
            </div>
          </div>
        </button>
      </div>

      <div class="mt-4 flex justify-end">
        <button mat-button type="button" (click)="choose(undefined)">Cancelar</button>
      </div>
    </div>
  `,
})
export class LogoutDialog {
  private readonly dialogRef = inject(MatDialogRef<LogoutDialog, LogoutDialogResult>);

  protected choose(result: LogoutDialogResult): void {
    this.dialogRef.close(result);
  }
}
