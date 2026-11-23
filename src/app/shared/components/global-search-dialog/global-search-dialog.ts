import {
  AfterViewInit,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { TOPIC_STATUS_LABELS, TaiBlock, Topic } from '../../../core/models/study.models';
import { SearchService, TopicSearchResult } from '../../../core/services/search.service';
import { StudyStoreService } from '../../../core/services/study-store.service';

interface RecentTopicItem {
  topic: Topic;
  block?: TaiBlock;
}

@Component({
  selector: 'app-global-search-dialog',
  imports: [FormsModule, MatDialogModule, MatIconModule],
  templateUrl: './global-search-dialog.html',
})
export class GlobalSearchDialog implements AfterViewInit {
  private readonly dialogRef = inject(MatDialogRef<GlobalSearchDialog>);
  private readonly router = inject(Router);
  private readonly searchService = inject(SearchService);
  private readonly store = inject(StudyStoreService);

  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  protected readonly statusLabels = TOPIC_STATUS_LABELS;
  protected readonly query = signal('');
  protected readonly activeIndex = signal(0);

  protected readonly hasQuery = computed(() => this.query().trim().length > 0);

  protected readonly results = computed<TopicSearchResult[]>(() => {
    if (!this.hasQuery()) {
      return [];
    }
    return this.searchService.search(this.query(), 18);
  });

  protected readonly recentTopics = computed<RecentTopicItem[]>(() => {
    return [...this.store.topics()]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 6)
      .map((topic) => ({
        topic,
        block: this.store.getBlockById(topic.blockId),
      }));
  });

  protected readonly selectableTopics = computed<Topic[]>(() =>
    this.hasQuery()
      ? this.results().map((item) => item.topic)
      : this.recentTopics().map((item) => item.topic),
  );

  constructor() {
    effect(() => {
      // Reset highlighted row whenever the result list changes.
      this.selectableTopics();
      this.activeIndex.set(0);
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.inputRef()?.nativeElement.focus();
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    const items = this.selectableTopics();
    if (items.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex.update((index) => (index + 1) % items.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.update((index) => (index - 1 + items.length) % items.length);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const chosen = items[this.activeIndex()] ?? items[0];
      if (chosen) {
        void this.openTopic(chosen);
      }
    }
  }

  protected clearQuery(): void {
    this.query.set('');
    this.inputRef()?.nativeElement.focus();
  }

  protected async openTopic(topic: Topic): Promise<void> {
    this.dialogRef.close();
    await this.router.navigate(['/blocks', topic.blockId, 'topics', topic.id]);
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
