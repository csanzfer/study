import { DatePipe } from '@angular/common';
import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { BackupService } from '../../core/services/backup.service';
import { StudyStoreService } from '../../core/services/study-store.service';

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, MatSnackBarModule],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  protected readonly store = inject(StudyStoreService);
  protected readonly backup = inject(BackupService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  protected async exportBackup(): Promise<void> {
    try {
      const payload = await this.backup.downloadBackup();
      this.snackBar.open(
        `Copia descargada con ${payload.topics.length} temas.`,
        'Cerrar',
        { duration: 3500 },
      );
    } catch {
      this.snackBar.open('Error al exportar el backup.', 'Cerrar', { duration: 4000 });
    }
  }

  protected openImportDialog(): void {
    this.fileInput()?.nativeElement.click();
  }

  protected async onImportFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    try {
      const result = await this.backup.importBackupFile(file);
      await this.store.refresh();
      this.snackBar.open(
        `Restauración completada (${result.blocksCount} bloques, ${result.topicsCount} temas).`,
        'Cerrar',
        { duration: 4000 },
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo importar la copia de seguridad.';
      this.snackBar.open(message, 'Cerrar', { duration: 5000 });
    }
  }
}
