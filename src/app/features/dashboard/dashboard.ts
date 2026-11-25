import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDragPlaceholder,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { DatePipe } from '@angular/common';
import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CreateBlockInput, StudyBlock } from '../../core/models/study.models';
import { BackupService } from '../../core/services/backup.service';
import { StudyStoreService } from '../../core/services/study-store.service';
import {
  BlockEditorDialog,
  BlockEditorDialogData,
} from '../../shared/components/block-editor-dialog/block-editor-dialog';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../shared/components/confirm-dialog/confirm-dialog';
import { formatMinutesAsHours } from '../../shared/utils/week-date.util';

@Component({
  selector: 'app-dashboard',
  imports: [
    DatePipe,
    RouterLink,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    CdkDragPlaceholder,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatMenuModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  protected readonly store = inject(StudyStoreService);
  protected readonly backup = inject(BackupService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  protected formatDuration(minutes: number): string {
    return formatMinutesAsHours(minutes);
  }

  protected async openCreateBlockDialog(): Promise<void> {
    const dialogRef = this.dialog.open<
      BlockEditorDialog,
      BlockEditorDialogData,
      CreateBlockInput
    >(BlockEditorDialog, {
      width: '560px',
      maxWidth: '95vw',
      data: {},
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    if (!result) {
      return;
    }

    const created = await this.store.createBlock(result);
    this.snackBar.open(`Asignatura "${created.title}" creada.`, 'Cerrar', { duration: 3000 });
  }

  protected async openEditBlockDialog(block: StudyBlock): Promise<void> {
    const dialogRef = this.dialog.open<
      BlockEditorDialog,
      BlockEditorDialogData,
      CreateBlockInput
    >(BlockEditorDialog, {
      width: '560px',
      maxWidth: '95vw',
      data: { block },
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    if (!result) {
      return;
    }

    await this.store.updateBlock(block.id, result);
    this.snackBar.open(`Asignatura "${result.title}" actualizada.`, 'Cerrar', { duration: 2500 });
  }

  protected async removeBlock(block: StudyBlock): Promise<void> {
    const topicsCount = this.store.topicCountByBlock()[block.id] ?? 0;
    const questionsCount = this.store.questionCountByBlock()[block.id] ?? 0;
    const flashcardsCount = this.store.flashcardCountByBlock()[block.id] ?? 0;

    const details = `${topicsCount} ${topicsCount === 1 ? 'tema' : 'temas'}, ${questionsCount} ${questionsCount === 1 ? 'pregunta' : 'preguntas'} y ${flashcardsCount} ${flashcardsCount === 1 ? 'flashcard' : 'flashcards'}`;

    const dialogRef = this.dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
      data: {
        title: `Eliminar "${block.title}"`,
        message: `¿Seguro que quieres eliminar esta asignatura? También se borrarán ${details} asociados a ella. Esta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar',
        cancelLabel: 'Cancelar',
        danger: true,
      },
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmed) {
      return;
    }

    await this.store.deleteBlock(block.id);
    this.snackBar.open(`Asignatura "${block.title}" eliminada.`, 'Cerrar', { duration: 3000 });
  }

  protected async onBlockDrop(event: CdkDragDrop<StudyBlock[]>): Promise<void> {
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    const reordered = [...this.store.blocks()];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);
    await this.store.reorderBlocks(reordered.map((block) => block.id));
  }

  protected async moveBlock(index: number, delta: -1 | 1): Promise<void> {
    const blocks = [...this.store.blocks()];
    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= blocks.length) {
      return;
    }
    moveItemInArray(blocks, index, targetIndex);
    await this.store.reorderBlocks(blocks.map((block) => block.id));
  }

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
