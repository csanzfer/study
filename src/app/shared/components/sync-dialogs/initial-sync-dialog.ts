import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { InitialSyncStrategy } from '../../../core/models/study.models';
import { BackupService } from '../../../core/services/backup.service';
import { InitialSyncAssessment } from '../../../core/services/supabase-sync.service';

export interface InitialSyncDialogData {
  assessment: InitialSyncAssessment;
  userEmail: string;
}

@Component({
  selector: 'app-initial-sync-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <div class="p-6">
      <div class="mb-4 flex items-start gap-3">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
          <mat-icon>compare_arrows</mat-icon>
        </div>
        <div>
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">
            @if (data.assessment.isDifferentUser) {
              Cuenta distinta detectada
            } @else {
              Datos locales y en la nube detectados
            }
          </h2>
          <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Sesión iniciada como <strong class="text-slate-700 dark:text-slate-200">{{ data.userEmail }}</strong>
          </p>
        </div>
      </div>

      <div class="mb-4 grid grid-cols-2 gap-3 text-xs">
        <div class="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
          <div class="font-semibold text-slate-700 dark:text-slate-200">Este dispositivo</div>
          <div class="mt-1 text-slate-500 dark:text-slate-400">
            {{ data.assessment.localBlockCount }} bloques · {{ data.assessment.localTopicCount }} temas
          </div>
        </div>
        <div class="rounded-xl border border-cyan-200 bg-cyan-50/70 p-3 dark:border-cyan-900/60 dark:bg-cyan-950/30">
          <div class="font-semibold text-cyan-800 dark:text-cyan-200">En la nube</div>
          <div class="mt-1 text-cyan-700/80 dark:text-cyan-300/80">
            {{ data.assessment.cloudBlockCount }} bloques · {{ data.assessment.cloudTopicCount }} temas
          </div>
        </div>
      </div>

      @if (data.assessment.isDifferentUser) {
        <p class="mb-4 text-xs text-amber-700 dark:text-amber-300">
          Los datos locales pertenecen a otra cuenta anterior. Para evitar mezclar apuntes entre usuarios, te recomendamos descargar un backup local antes de cargar los datos de tu cuenta.
        </p>
      } @else {
        <p class="mb-4 text-xs text-slate-600 dark:text-slate-300">
          Elige cómo quieres combinar los datos en esta primera sincronización. Puedes descargar una copia de seguridad local antes de continuar.
        </p>
      }

      <div class="mb-4">
        <button
          mat-stroked-button
          type="button"
          (click)="downloadSafetyBackup()"
          class="!w-full !rounded-xl">
          <mat-icon>download</mat-icon>
          <span>{{ backupDone() ? 'Backup local descargado ✓' : 'Descargar backup local de seguridad (.json)' }}</span>
        </button>
      </div>

      <div class="space-y-2">
        @if (!data.assessment.isDifferentUser) {
          <button
            type="button"
            (click)="select('merge')"
            class="flex w-full items-start gap-3 rounded-xl border border-cyan-500 bg-cyan-50/80 p-3 text-left transition hover:bg-cyan-100/70 dark:border-cyan-600 dark:bg-cyan-950/40 dark:hover:bg-cyan-950/60">
            <mat-icon class="mt-0.5 text-cyan-600 dark:text-cyan-400">merge</mat-icon>
            <div>
              <div class="text-sm font-semibold text-slate-900 dark:text-white">
                Fusionar datos (Recomendado)
              </div>
              <div class="text-xs text-slate-600 dark:text-slate-300">
                Une ambos orígenes conservando la versión más reciente de cada elemento.
              </div>
            </div>
          </button>
        }

        <button
          type="button"
          (click)="select('use_cloud')"
          class="flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
          <mat-icon class="mt-0.5 text-slate-600 dark:text-slate-300">cloud_download</mat-icon>
          <div>
            <div class="text-sm font-semibold text-slate-900 dark:text-white">
              Usar datos de la nube
            </div>
            <div class="text-xs text-slate-500 dark:text-slate-400">
              Reemplaza los datos locales de este dispositivo por los guardados en tu cuenta.
            </div>
          </div>
        </button>

        @if (!data.assessment.isDifferentUser) {
          <button
            type="button"
            (click)="select('upload_local')"
            class="flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
            <mat-icon class="mt-0.5 text-slate-600 dark:text-slate-300">cloud_upload</mat-icon>
            <div>
              <div class="text-sm font-semibold text-slate-900 dark:text-white">
                Subir datos locales
              </div>
              <div class="text-xs text-slate-500 dark:text-slate-400">
                Sobrescribe la nube con los datos actuales de este dispositivo.
              </div>
            </div>
          </button>
        }
      </div>
    </div>
  `,
})
export class InitialSyncDialog {
  protected readonly data = inject<InitialSyncDialogData>(MAT_DIALOG_DATA);
  private readonly backup = inject(BackupService);
  private readonly dialogRef = inject(
    MatDialogRef<InitialSyncDialog, InitialSyncStrategy | undefined>,
  );

  protected readonly backupDone = signal(false);

  protected async downloadSafetyBackup(): Promise<void> {
    await this.backup.downloadBackup();
    this.backupDone.set(true);
  }

  protected select(strategy: InitialSyncStrategy): void {
    this.dialogRef.close(strategy);
  }
}
