import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, CanDeactivateFn, Router, RouterLink } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import {
  CreateQuestionInput,
  TOPIC_STATUS_LABELS,
  TOPIC_STATUS_LIST,
  TaiBlockId,
  TopicStatus,
  UpdateTopicPatch,
} from '../../../core/models/study.models';
import { PomodoroService } from '../../../core/services/pomodoro.service';
import { StudyStoreService } from '../../../core/services/study-store.service';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog';
import { OutlineDepth, tiptapJsonToOutlineMarkdown } from '../../../shared/utils/tiptap-outline.util';
import { MarkmapViewer } from '../../schemas/components/markmap-viewer/markmap-viewer';
import { NoteEditor, NoteEditorChange } from '../editor/note-editor';
import {
  NoteImportDialog,
  NoteImportDialogData,
  NoteImportDialogResult,
} from '../import-dialog/note-import-dialog';
import { NoteImportService } from '../services/note-import.service';
import {
  TopicQuestionGeneratorDialog,
  TopicQuestionGeneratorDialogData,
} from '../../tests/topic-question-generator-dialog/topic-question-generator-dialog';

export type TopicViewMode = 'note' | 'schema' | 'split';
export type SchemaSourceMode = 'auto' | 'custom';
export type SaveState = 'saved' | 'unsaved' | 'saving';

const AUTOSAVE_DEBOUNCE_MS = 800;

@Component({
  selector: 'app-topic-detail',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatSnackBarModule,
    MatTooltipModule,
    MarkmapViewer,
    NoteEditor,
  ],
  templateUrl: './topic-detail.html',
})
export class TopicDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly importService = inject(NoteImportService);
  private readonly noteEditor = viewChild(NoteEditor);
  protected readonly store = inject(StudyStoreService);
  private readonly pomodoro = inject(PomodoroService);

  protected readonly statusLabels = TOPIC_STATUS_LABELS;
  protected readonly statusList = TOPIC_STATUS_LIST;

  protected readonly viewMode = signal<TopicViewMode>('note');
  protected readonly schemaSource = signal<SchemaSourceMode>('auto');
  protected readonly outlineDepth = signal<OutlineDepth>('full');
  protected readonly titleDraft = signal('');
  protected readonly newTagInput = signal('');
  protected readonly saveState = signal<SaveState>('saved');
  protected readonly liveContentJson = signal<unknown>(null);
  protected readonly customOutlineDraft = signal('');

  private syncedTopicId = '';
  private syncedTitle = '';
  private pendingSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingChange: { topicId: string; patch: UpdateTopicPatch } | null = null;
  private activeSavePromise: Promise<void> | null = null;

  private readonly params = toSignal(
    this.route.paramMap.pipe(
      map((paramMap) => ({
        blockId: (paramMap.get('blockId') as TaiBlockId) ?? 'B1',
        topicId: paramMap.get('topicId') ?? '',
      })),
    ),
    { initialValue: { blockId: 'B1' as TaiBlockId, topicId: '' } },
  );

  protected readonly blockId = computed(() => this.params().blockId);
  protected readonly topicId = computed(() => this.params().topicId);

  protected readonly topic = computed(() => this.store.getTopicById(this.topicId()));
  protected readonly block = computed(() =>
    this.store.getBlockById(this.topic()?.blockId ?? this.blockId()),
  );
  protected readonly outline = computed(() =>
    tiptapJsonToOutlineMarkdown(this.liveContentJson(), {
      depth: this.outlineDepth(),
      rootTitle: this.topic()?.title ?? '',
    }),
  );
  protected readonly activeSchemaMarkdown = computed(() =>
    this.schemaSource() === 'custom' ? this.customOutlineDraft() : this.outline().markdown,
  );

  constructor() {
    effect(() => {
      const current = this.topic();
      if (current) {
        const isNewTopic = this.syncedTopicId !== current.id;
        if (isNewTopic) {
          if (this.pendingChange && this.pendingChange.topicId !== current.id) {
            void this.flushPendingSave();
          }
          this.syncedTopicId = current.id;
          this.syncedTitle = current.title;
          this.titleDraft.set(current.title);
          this.liveContentJson.set(current.contentJson ?? null);
          const savedCustom = current.customOutlineMd ?? '';
          this.customOutlineDraft.set(savedCustom);
          this.schemaSource.set(savedCustom.trim().length > 0 ? 'custom' : 'auto');
        } else {
          if (current.title !== this.syncedTitle) {
            this.syncedTitle = current.title;
            this.titleDraft.set(current.title);
          }
          if (!this.pendingChange) {
            this.liveContentJson.set(current.contentJson ?? null);
            this.customOutlineDraft.set(current.customOutlineMd ?? '');
          }
        }
      } else {
        this.syncedTopicId = '';
        this.syncedTitle = '';
        this.liveContentJson.set(null);
        this.customOutlineDraft.set('');
      }
    });

    this.destroyRef.onDestroy(() => {
      void this.flushPendingSave();
    });
  }

  protected onEditorContentChange(change: NoteEditorChange): void {
    const current = this.topic();
    if (!current) {
      return;
    }

    this.liveContentJson.set(change.contentJson);
    this.queueAutosave(current.id, {
      contentJson: change.contentJson,
      plainText: change.plainText,
    });
  }

  protected onCustomOutlineChange(value: string): void {
    const current = this.topic();
    if (!current) {
      return;
    }

    this.customOutlineDraft.set(value);
    this.queueAutosave(current.id, {
      customOutlineMd: value,
    });
  }

  protected copyAutoOutlineToCustom(): void {
    const generated = this.outline().markdown;
    if (!generated.trim()) {
      this.snackBar.open('El apunte aún no tiene estructura que copiar.', 'Cerrar', { duration: 2200 });
      return;
    }

    this.schemaSource.set('custom');
    this.onCustomOutlineChange(generated);
    this.snackBar.open('Estructura del apunte copiada al esquema propio.', 'Cerrar', {
      duration: 2200,
    });
  }

  protected onCustomOutlineKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') {
      return;
    }

    const textarea = event.target as HTMLTextAreaElement | null;
    if (!textarea) {
      return;
    }

    event.preventDefault();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = this.customOutlineDraft();
    const updated = `${current.slice(0, start)}  ${current.slice(end)}`;
    this.onCustomOutlineChange(updated);

    requestAnimationFrame(() => {
      textarea.selectionStart = start + 2;
      textarea.selectionEnd = start + 2;
    });
  }

  private queueAutosave(topicId: string, patch: UpdateTopicPatch): void {
    if (this.pendingChange && this.pendingChange.topicId !== topicId) {
      void this.flushPendingSave();
    }

    if (this.pendingChange && this.pendingChange.topicId === topicId) {
      this.pendingChange = {
        topicId,
        patch: { ...this.pendingChange.patch, ...patch },
      };
    } else {
      this.pendingChange = { topicId, patch };
    }

    this.saveState.set('unsaved');

    if (this.pendingSaveTimer !== null) {
      clearTimeout(this.pendingSaveTimer);
    }

    this.pendingSaveTimer = setTimeout(() => {
      this.pendingSaveTimer = null;
      void this.flushPendingSave();
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  async flushPendingSave(): Promise<void> {
    if (this.pendingSaveTimer !== null) {
      clearTimeout(this.pendingSaveTimer);
      this.pendingSaveTimer = null;
    }

    if (!this.pendingChange) {
      if (this.activeSavePromise) {
        await this.activeSavePromise;
      }
      return;
    }

    const { topicId, patch } = this.pendingChange;
    this.pendingChange = null;
    this.saveState.set('saving');

    const saveTask = this.store
      .updateTopic(topicId, patch)
      .then(() => {
        if (!this.pendingChange) {
          this.saveState.set('saved');
        }
      })
      .catch(() => {
        if (!this.pendingChange) {
          this.pendingChange = { topicId, patch };
        } else if (this.pendingChange.topicId === topicId) {
          this.pendingChange = {
            topicId,
            patch: { ...patch, ...this.pendingChange.patch },
          };
        }
        this.saveState.set('unsaved');
        this.snackBar.open(
          'No se pudieron guardar los cambios en IndexedDB. Vuelve a intentarlo.',
          'Cerrar',
          { duration: 3500 },
        );
      });

    this.activeSavePromise = saveTask;
    try {
      await saveTask;
    } finally {
      if (this.activeSavePromise === saveTask) {
        this.activeSavePromise = null;
      }
    }
  }

  protected async saveTitle(): Promise<void> {
    const current = this.topic();
    if (!current) {
      return;
    }

    const trimmed = this.titleDraft().trim();
    if (!trimmed) {
      this.titleDraft.set(current.title);
      return;
    }

    if (trimmed === current.title) {
      return;
    }

    await this.store.updateTopic(current.id, { title: trimmed });
    this.snackBar.open('Título guardado.', 'Cerrar', { duration: 1800 });
  }

  protected async onStatusChange(status: TopicStatus): Promise<void> {
    const current = this.topic();
    if (!current || current.status === status) {
      return;
    }

    const result = await this.store.moveTopicStatus(current.id, status);
    if (result?.roundIncremented) {
      this.snackBar.open(
        `Tema dominado · Vuelta #${result.topic.roundCount} registrada.`,
        'Cerrar',
        { duration: 3000 },
      );
    }
  }

  protected async logExtraRound(): Promise<void> {
    const current = this.topic();
    if (!current) {
      return;
    }

    const updated = await this.store.logTopicReview(current.id, true);
    if (updated) {
      this.snackBar.open(`Vuelta #${updated.roundCount} registrada hoy.`, 'Cerrar', {
        duration: 2400,
      });
    }
  }

  protected startPomodoroForCurrentTopic(): void {
    const current = this.topic();
    if (!current) {
      return;
    }

    let message: string;
    if (this.pomodoro.phase() === 'focus' && this.pomodoro.status() === 'running') {
      if (this.pomodoro.selectedTopicId() === current.id) {
        message = `El Pomodoro ya está activo para "${current.title}".`;
      } else {
        this.pomodoro.selectTopic(current.id);
        message = `Pomodoro vinculado ahora a "${current.title}".`;
      }
    } else {
      if (this.pomodoro.phase() !== 'focus') {
        this.pomodoro.setPhase('focus');
      }
      this.pomodoro.start(current.id);
      message = `Pomodoro iniciado para "${current.title}".`;
    }

    this.snackBar.open(message, 'Ver panel', {
      duration: 3000,
    }).onAction().subscribe(() => {
      void this.router.navigate(['/planner'], { queryParams: { tab: 'pomodoro' } });
    });
  }

  protected async addTag(): Promise<void> {
    const current = this.topic();
    const raw = this.newTagInput().trim();
    if (!current || !raw) {
      return;
    }

    const incoming = raw
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (incoming.length === 0) {
      return;
    }

    const merged = Array.from(new Set([...current.tags, ...incoming]));
    this.newTagInput.set('');
    await this.store.updateTopic(current.id, { tags: merged });
  }

  protected async removeTag(tagToRemove: string): Promise<void> {
    const current = this.topic();
    if (!current) {
      return;
    }

    const nextTags = current.tags.filter((tag) => tag !== tagToRemove);
    await this.store.updateTopic(current.id, { tags: nextTags });
  }

  protected setViewMode(mode: TopicViewMode): void {
    this.viewMode.set(mode);
  }

  protected setSchemaSource(source: SchemaSourceMode): void {
    this.schemaSource.set(source);
  }

  protected setOutlineDepth(depth: OutlineDepth): void {
    this.outlineDepth.set(depth);
  }

  protected async openImportDialog(): Promise<void> {
    const current = this.topic();
    if (!current) {
      return;
    }

    await this.flushPendingSave();

    const dialogRef = this.dialog.open<
      NoteImportDialog,
      NoteImportDialogData,
      NoteImportDialogResult
    >(NoteImportDialog, {
      width: '680px',
      maxWidth: '95vw',
      data: {
        mode: 'insert-into-topic',
        topicTitle: current.title,
      },
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    if (!result || result.mode !== 'insert-into-topic') {
      return;
    }

    const latest = this.topic() ?? current;
    const next =
      result.insertMode === 'append'
        ? this.importService.mergeTipTapDocuments(latest.contentJson, result.item.contentJson)
        : {
          contentJson: result.item.contentJson,
          plainText: result.item.plainText,
        };

    await this.store.updateTopic(latest.id, {
      contentJson: next.contentJson,
      plainText: next.plainText,
    });

    this.liveContentJson.set(next.contentJson);
    this.noteEditor()?.setExternalContent(next.contentJson);
    this.saveState.set('saved');
    this.snackBar.open(
      result.insertMode === 'replace'
        ? 'Contenido del tema reemplazado.'
        : 'Contenido añadido al final del tema.',
      'Cerrar',
      { duration: 2500 },
    );
  }

  protected async openGenerateQuestionsDialog(): Promise<void> {
    const current = this.topic();
    if (!current) {
      return;
    }

    await this.flushPendingSave();

    const ref = this.dialog.open<
      TopicQuestionGeneratorDialog,
      TopicQuestionGeneratorDialogData,
      CreateQuestionInput[]
    >(TopicQuestionGeneratorDialog, {
      width: '860px',
      maxWidth: '96vw',
      data: {
        topicId: current.id,
        blockId: current.blockId,
      },
    });

    const generated = await firstValueFrom(ref.afterClosed());
    if (!generated || generated.length === 0) {
      return;
    }

    await this.store.bulkCreateQuestions(generated);
    this.snackBar.open(
      `${generated.length} preguntas generadas para "${current.title}".`,
      'Cerrar',
      { duration: 3500 },
    );
  }

  protected async deleteTopic(): Promise<void> {
    const current = this.topic();
    if (!current) {
      return;
    }

    const dialogRef = this.dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
      data: {
        title: 'Eliminar tema',
        message: `¿Seguro que quieres eliminar "${current.title}"? Se perderán sus apuntes y su esquema local.`,
        confirmLabel: 'Eliminar',
        cancelLabel: 'Cancelar',
        danger: true,
      },
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmed) {
      return;
    }

    // Cancel any pending autosave for the topic being deleted
    if (this.pendingSaveTimer !== null) {
      clearTimeout(this.pendingSaveTimer);
      this.pendingSaveTimer = null;
    }
    this.pendingChange = null;
    this.saveState.set('saved');

    await this.store.deleteTopic(current.id);
    this.snackBar.open(`Tema "${current.title}" eliminado.`, 'Cerrar', { duration: 2500 });
    await this.router.navigate(['/blocks', this.blockId()]);
  }
}

export const topicDetailCanDeactivateGuard: CanDeactivateFn<TopicDetail> = async (component) => {
  await component.flushPendingSave();
  return true;
};
