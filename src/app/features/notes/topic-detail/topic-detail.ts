import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import {
  TOPIC_STATUS_LABELS,
  TOPIC_STATUS_LIST,
  TaiBlockId,
  TopicStatus,
} from '../../../core/models/study.models';
import { StudyStoreService } from '../../../core/services/study-store.service';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog';

export type TopicViewMode = 'note' | 'schema' | 'split';

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
  ],
  templateUrl: './topic-detail.html',
})
export class TopicDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly store = inject(StudyStoreService);

  protected readonly statusLabels = TOPIC_STATUS_LABELS;
  protected readonly statusList = TOPIC_STATUS_LIST;

  protected readonly viewMode = signal<TopicViewMode>('note');
  protected readonly titleDraft = signal('');
  protected readonly newTagInput = signal('');

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

  protected readonly block = computed(() => this.store.getBlockById(this.blockId()));
  protected readonly topic = computed(() => this.store.getTopicById(this.topicId()));

  constructor() {
    effect(() => {
      const current = this.topic();
      if (current) {
        this.titleDraft.set(current.title);
      }
    });
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

    await this.store.updateTopic(current.id, { status });
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

    await this.store.deleteTopic(current.id);
    this.snackBar.open(`Tema "${current.title}" eliminado.`, 'Cerrar', { duration: 2500 });
    await this.router.navigate(['/blocks', this.blockId()]);
  }
}
