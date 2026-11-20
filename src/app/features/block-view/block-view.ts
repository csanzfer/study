import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import {
  TOPIC_STATUS_LABELS,
  TaiBlockId,
  Topic,
} from '../../core/models/study.models';
import { StudyStoreService } from '../../core/services/study-store.service';

@Component({
  selector: 'app-block-view',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
  ],
  templateUrl: './block-view.html',
})
export class BlockView {
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly store = inject(StudyStoreService);

  protected readonly statusLabels = TOPIC_STATUS_LABELS;
  protected readonly newTopicTitle = signal('');
  protected readonly newTopicTags = signal('');

  protected readonly blockId = toSignal(
    this.route.paramMap.pipe(map((params) => (params.get('blockId') as TaiBlockId) ?? 'B1')),
    { initialValue: 'B1' as TaiBlockId },
  );

  protected readonly block = computed(() => this.store.getBlockById(this.blockId()));

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

    const tags = this.newTopicTags()
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    await this.store.createTopic({
      blockId: this.blockId(),
      title,
      tags,
    });

    this.newTopicTitle.set('');
    this.newTopicTags.set('');
    this.snackBar.open('Tema guardado en IndexedDB.', 'Cerrar', { duration: 2500 });
  }

  protected async removeTopic(topic: Topic): Promise<void> {
    await this.store.deleteTopic(topic.id);
    this.snackBar.open(`Tema "${topic.title}" eliminado.`, 'Cerrar', { duration: 2500 });
  }
}
