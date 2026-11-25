import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDragPlaceholder,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import {
  CreateBlockInput,
  StudyBlockId,
  TOPIC_STATUS_LABELS,
  TOPIC_STATUS_LIST,
  Topic,
  TopicStatus,
} from '../../core/models/study.models';
import { StudyStoreService } from '../../core/services/study-store.service';
import {
  BlockEditorDialog,
  BlockEditorDialogData,
} from '../../shared/components/block-editor-dialog/block-editor-dialog';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../shared/components/confirm-dialog/confirm-dialog';
import {
  NoteImportDialog,
  NoteImportDialogData,
  NoteImportDialogResult,
} from '../notes/import-dialog/note-import-dialog';
import { TopicExportService } from '../notes/services/topic-export.service';

@Component({
  selector: 'app-block-view',
  imports: [
    DatePipe,
    FormsModule,
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
  templateUrl: './block-view.html',
})
export class BlockView {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly exportService = inject(TopicExportService);
  protected readonly store = inject(StudyStoreService);

  protected readonly statusLabels = TOPIC_STATUS_LABELS;
  protected readonly statusList = TOPIC_STATUS_LIST;

  protected readonly newTopicTitle = signal('');
  protected readonly newTopicTags = signal('');

  protected readonly editingTopicId = signal<string | null>(null);
  protected readonly editTitle = signal('');
  protected readonly editTags = signal('');
  protected readonly editStatus = signal<TopicStatus>('pending');

  protected readonly blockId = toSignal(
    this.route.paramMap.pipe(map((params) => (params.get('blockId') as StudyBlockId) ?? '')),
    { initialValue: '' as StudyBlockId },
  );

  protected readonly block = computed(() => this.store.getBlockById(this.blockId()));

  protected readonly isFiltered = computed(() => this.store.searchQuery().trim().length > 0);

  protected readonly topics = computed(() => {
    const query = this.store.searchQuery().trim().toLowerCase();
    const list = this.store.getTopicsForBlock(this.blockId());
    if (!query) {
      return list;
    }
    return list.filter(
      (topic) =>
        topic.title.toLowerCase().includes(query) ||
        topic.plainText.toLowerCase().includes(query) ||
        topic.tags.some((tag) => tag.toLowerCase().includes(query)),
    );
  });

  protected async addTopic(): Promise<void> {
    const title = this.newTopicTitle().trim();
    if (!title) {
      return;
    }

    const tags = this.parseTags(this.newTopicTags());

    await this.store.createTopic({
      blockId: this.blockId(),
      title,
      tags,
    });

    this.newTopicTitle.set('');
    this.newTopicTags.set('');
    this.snackBar.open('Tema creado y guardado en IndexedDB.', 'Cerrar', { duration: 2500 });
  }

  protected async openImportDialog(): Promise<void> {
    const currentBlock = this.block();
    const dialogRef = this.dialog.open<
      NoteImportDialog,
      NoteImportDialogData,
      NoteImportDialogResult
    >(NoteImportDialog, {
      width: '680px',
      maxWidth: '95vw',
      data: {
        mode: 'create-topics',
        blockLabel: currentBlock?.code,
      },
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    if (!result || result.mode !== 'create-topics' || result.items.length === 0) {
      return;
    }

    for (const item of result.items) {
      await this.store.createTopic({
        blockId: this.blockId(),
        title: item.title,
        tags: item.tags,
        contentJson: item.contentJson,
        plainText: item.plainText,
      });
    }

    const count = result.items.length;
    this.snackBar.open(
      count === 1
        ? `Tema "${result.items[0].title}" importado correctamente.`
        : `${count} temas importados correctamente.`,
      'Cerrar',
      { duration: 3000 },
    );
  }

  protected startEdit(topic: Topic): void {
    this.editingTopicId.set(topic.id);
    this.editTitle.set(topic.title);
    this.editTags.set(topic.tags.join(', '));
    this.editStatus.set(topic.status);
  }

  protected cancelEdit(): void {
    this.editingTopicId.set(null);
  }

  protected async saveEdit(topic: Topic): Promise<void> {
    const title = this.editTitle().trim();
    if (!title) {
      return;
    }

    await this.store.updateTopic(topic.id, {
      title,
      tags: this.parseTags(this.editTags()),
      status: this.editStatus(),
    });

    this.editingTopicId.set(null);
    this.snackBar.open('Tema actualizado.', 'Cerrar', { duration: 2000 });
  }

  protected async onDrop(event: CdkDragDrop<Topic[]>): Promise<void> {
    if (this.isFiltered() || event.previousIndex === event.currentIndex) {
      return;
    }

    const reordered = [...this.topics()];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);
    await this.store.reorderTopics(
      this.blockId(),
      reordered.map((item) => item.id),
    );
  }

  protected async removeTopic(topic: Topic): Promise<void> {
    const dialogRef = this.dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
      data: {
        title: 'Eliminar tema',
        message: `¿Seguro que quieres eliminar "${topic.title}"? Se perderán sus apuntes y su esquema local.`,
        confirmLabel: 'Eliminar',
        cancelLabel: 'Cancelar',
        danger: true,
      },
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmed) {
      return;
    }

    await this.store.deleteTopic(topic.id);
    if (this.editingTopicId() === topic.id) {
      this.editingTopicId.set(null);
    }
    this.snackBar.open(`Tema "${topic.title}" eliminado.`, 'Cerrar', { duration: 2500 });
  }

  protected async openEditBlockDialog(): Promise<void> {
    const currentBlock = this.block();
    if (!currentBlock) {
      return;
    }

    const dialogRef = this.dialog.open<
      BlockEditorDialog,
      BlockEditorDialogData,
      CreateBlockInput
    >(BlockEditorDialog, {
      width: '560px',
      maxWidth: '95vw',
      data: { block: currentBlock },
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    if (!result) {
      return;
    }

    await this.store.updateBlock(currentBlock.id, result);
    this.snackBar.open(`Asignatura "${result.title}" actualizada.`, 'Cerrar', { duration: 2500 });
  }

  protected async removeCurrentBlock(): Promise<void> {
    const currentBlock = this.block();
    if (!currentBlock) {
      return;
    }

    const topicsCount = this.store.topicCountByBlock()[currentBlock.id] ?? 0;
    const questionsCount = this.store.questionCountByBlock()[currentBlock.id] ?? 0;
    const flashcardsCount = this.store.flashcardCountByBlock()[currentBlock.id] ?? 0;
    const details = `${topicsCount} ${topicsCount === 1 ? 'tema' : 'temas'}, ${questionsCount} ${questionsCount === 1 ? 'pregunta' : 'preguntas'} y ${flashcardsCount} ${flashcardsCount === 1 ? 'flashcard' : 'flashcards'}`;

    const dialogRef = this.dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
      data: {
        title: `Eliminar "${currentBlock.title}"`,
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

    await this.store.deleteBlock(currentBlock.id);
    this.snackBar.open(`Asignatura "${currentBlock.title}" eliminada.`, 'Cerrar', {
      duration: 3000,
    });
    await this.router.navigate(['/dashboard']);
  }

  protected exportBlockMarkdown(): void {
    const currentBlock = this.block();
    const allTopics = this.store.getTopicsForBlock(this.blockId());
    if (!currentBlock || allTopics.length === 0) {
      return;
    }

    const filename = this.exportService.downloadBlockMarkdown(currentBlock, allTopics);
    this.snackBar.open(
      `Cuaderno de ${currentBlock.code} exportado como ${filename}.`,
      'Cerrar',
      { duration: 3000 },
    );
  }

  protected printBlockPdf(): void {
    const currentBlock = this.block();
    const allTopics = this.store.getTopicsForBlock(this.blockId());
    if (!currentBlock || allTopics.length === 0) {
      return;
    }

    this.exportService.printBlockPdf(currentBlock, allTopics);
  }

  private parseTags(raw: string): string[] {
    return Array.from(
      new Set(
        raw
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      ),
    );
  }
}
