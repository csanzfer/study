import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="p-6 max-w-md">
      <div class="flex items-start gap-3">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          [class.bg-red-100]="data.danger"
          [class.text-red-600]="data.danger"
          [class.dark:bg-red-950/60]="data.danger"
          [class.dark:text-red-400]="data.danger"
          [class.bg-blue-100]="!data.danger"
          [class.text-blue-600]="!data.danger"
          [class.dark:bg-blue-950/60]="!data.danger"
          [class.dark:text-blue-400]="!data.danger"
        >
          <mat-icon>{{ data.danger ? 'warning_amber' : 'help_outline' }}</mat-icon>
        </div>
        <div class="min-w-0">
          <h2 class="text-base font-semibold text-slate-900 dark:text-white">
            {{ data.title }}
          </h2>
          <p class="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
            {{ data.message }}
          </p>
        </div>
      </div>

      <div class="mt-6 flex justify-end gap-2">
        <button
          mat-stroked-button
          type="button"
          class="!rounded-xl"
          (click)="dialogRef.close(false)"
        >
          {{ data.cancelLabel ?? 'Cancelar' }}
        </button>
        <button
          mat-flat-button
          type="button"
          class="!rounded-xl"
          [class.!bg-red-600]="data.danger"
          [class.!text-white]="data.danger"
          (click)="dialogRef.close(true)"
        >
          {{ data.confirmLabel ?? 'Confirmar' }}
        </button>
      </div>
    </div>
  `,
})
export class ConfirmDialog {
  protected readonly dialogRef = inject(MatDialogRef<ConfirmDialog, boolean>);
  protected readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}
