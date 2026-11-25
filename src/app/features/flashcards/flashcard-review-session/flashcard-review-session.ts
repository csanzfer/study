import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  CreateFlashcardInput,
  FLASHCARD_RATING_LABELS,
  Flashcard,
  FlashcardRating,
  TaiBlockId,
} from '../../../core/models/study.models';
import { StudyStoreService } from '../../../core/services/study-store.service';
import {
  isFlashcardDue,
  previewSrsIntervals,
} from '../../../shared/utils/srs-sm2.util';
import {
  FlashcardEditorDialog,
  FlashcardEditorDialogData,
} from '../flashcard-editor-dialog/flashcard-editor-dialog';

export type ReviewDirection = 'normal' | 'reverse' | 'mixed';
export type ReviewQueueMode = 'due' | 'all';

@Component({
  selector: 'app-flashcard-review-session',
  imports: [FormsModule, RouterLink, MatButtonModule, MatIconModule],
  host: {
    '(window:keydown)': 'onKeydown($event)',
  },
  templateUrl: './flashcard-review-session.html',
})
export class FlashcardReviewSession {
  protected readonly store = inject(StudyStoreService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly initialBlockId = input<'ALL' | TaiBlockId>('ALL');
  readonly initialTopicId = input<string>('');
  readonly initialTag = input<string>('');
  readonly openImportRequest = output<'extract' | 'batch'>();

  protected readonly ratingLabels = FLASHCARD_RATING_LABELS;

  // Filters
  protected readonly blockFilter = signal<'ALL' | TaiBlockId>('ALL');
  protected readonly topicFilter = signal<string>('');
  protected readonly tagFilter = signal<string>('');
  protected readonly queueMode = signal<ReviewQueueMode>('due');
  protected readonly direction = signal<ReviewDirection>('normal');

  // Active session state
  protected readonly sessionActive = signal(false);
  protected readonly sessionFinished = signal(false);
  protected readonly queueIds = signal<string[]>([]);
  protected readonly currentIndex = signal(0);
  protected readonly flipped = signal(false);
  protected readonly showHint = signal(false);
  protected readonly cardReversed = signal(false);
  protected readonly sessionStartedAt = signal<number>(0);
  protected readonly ratingCounts = signal<Record<FlashcardRating, number>>({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });
  protected readonly reviewedTotal = signal(0);
  protected readonly xpEarned = signal(0);
  protected readonly submittingRating = signal(false);
  private reviewedBlockCounts: Record<TaiBlockId, number> = { B1: 0, B2: 0, B3: 0, B4: 0 };

  protected readonly topicsForBlock = computed(() => {
    const block = this.blockFilter();
    return block === 'ALL' ? this.store.topics() : this.store.getTopicsForBlock(block);
  });

  protected readonly matchingCards = computed(() => {
    const block = this.blockFilter();
    const topicId = this.topicFilter();
    const tag = this.tagFilter().trim().toLowerCase();
    const mode = this.queueMode();
    const today = new Date();

    return this.store.flashcards().filter((card) => {
      if (block !== 'ALL' && card.blockId !== block) return false;
      if (topicId && card.topicId !== topicId) return false;
      if (tag && !card.tags.some((t) => t.toLowerCase() === tag)) return false;
      if (mode === 'due' && !isFlashcardDue(card, today)) return false;
      return true;
    });
  });

  protected readonly currentCard = computed<Flashcard | undefined>(() => {
    const id = this.queueIds()[this.currentIndex()];
    return id ? this.store.getFlashcardById(id) : undefined;
  });

  protected readonly currentTopicTitle = computed(() => {
    const card = this.currentCard();
    if (!card?.topicId) return null;
    return this.store.getTopicById(card.topicId)?.title ?? null;
  });

  protected readonly intervalPreview = computed(() => {
    const card = this.currentCard();
    if (!card) {
      return { again: 'Hoy', hard: '1 día', good: '1 día', easy: '4 días' };
    }
    return previewSrsIntervals(card.srs);
  });

  protected readonly progressPercent = computed(() => {
    const total = this.queueIds().length;
    if (total === 0) return 0;
    return Math.round((this.currentIndex() / total) * 100);
  });

  constructor() {
    effect(() => {
      const b = this.initialBlockId();
      if (b) this.blockFilter.set(b);
    });
    effect(() => {
      const t = this.initialTopicId();
      if (t) this.topicFilter.set(t);
    });
    effect(() => {
      const tag = this.initialTag();
      if (tag) this.tagFilter.set(tag);
    });
  }

  protected toggleOnlyAcronyms(): void {
    if (this.tagFilter() === 'siglas') {
      this.tagFilter.set('');
    } else {
      this.tagFilter.set('siglas');
    }
  }

  protected startSession(): void {
    const cards = this.matchingCards();
    if (cards.length === 0) {
      return;
    }

    // Prioritize overdue / new cards first
    const orderedIds = cards.map((c) => c.id);
    this.queueIds.set(orderedIds);
    this.currentIndex.set(0);
    this.flipped.set(false);
    this.showHint.set(false);
    this.reviewedTotal.set(0);
    this.xpEarned.set(0);
    this.submittingRating.set(false);
    this.reviewedBlockCounts = { B1: 0, B2: 0, B3: 0, B4: 0 };
    this.ratingCounts.set({ again: 0, hard: 0, good: 0, easy: 0 });
    this.sessionStartedAt.set(Date.now());
    this.sessionFinished.set(false);
    this.sessionActive.set(true);
    this.resolveCardDirection();
  }

  protected flipCard(): void {
    if (!this.sessionActive() || this.sessionFinished()) {
      return;
    }
    this.flipped.set(true);
  }

  protected async rateCurrentCard(rating: FlashcardRating): Promise<void> {
    const card = this.currentCard();
    if (!card || !this.flipped() || this.submittingRating()) {
      return;
    }

    this.submittingRating.set(true);
    try {
      await this.store.reviewFlashcard(card.id, rating);

      const xpMap: Record<FlashcardRating, number> = { again: 2, hard: 4, good: 6, easy: 8 };
      this.xpEarned.update((xp) => xp + xpMap[rating]);
      this.reviewedTotal.update((n) => n + 1);
      this.reviewedBlockCounts[card.blockId] = (this.reviewedBlockCounts[card.blockId] ?? 0) + 1;
      this.ratingCounts.update((counts) => ({
        ...counts,
        [rating]: counts[rating] + 1,
      }));

      // If 'again', re-append card to the end of the current session queue once
      if (rating === 'again' && this.queueIds().length < 60) {
        this.queueIds.update((ids) => [...ids, card.id]);
      }

      const nextIdx = this.currentIndex() + 1;
      if (nextIdx >= this.queueIds().length) {
        await this.finishSession();
      } else {
        this.currentIndex.set(nextIdx);
        this.flipped.set(false);
        this.showHint.set(false);
        this.resolveCardDirection();
      }
    } finally {
      this.submittingRating.set(false);
    }
  }

  protected async editCurrentCard(): Promise<void> {
    const card = this.currentCard();
    if (!card) return;

    const ref = this.dialog.open<
      FlashcardEditorDialog,
      FlashcardEditorDialogData,
      CreateFlashcardInput
    >(FlashcardEditorDialog, {
      width: '620px',
      maxWidth: '95vw',
      data: { flashcard: card },
    });

    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;

    await this.store.updateFlashcard(card.id, result);
    this.snackBar.open('Flashcard actualizada.', 'Cerrar', { duration: 2000 });
  }

  protected exitSession(): void {
    this.sessionActive.set(false);
    this.sessionFinished.set(false);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.sessionActive() || this.sessionFinished() || this.dialog.openDialogs.length > 0) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)
    ) {
      return;
    }

    if (!this.flipped() && (event.code === 'Space' || event.key === 'Enter')) {
      event.preventDefault();
      this.flipCard();
      return;
    }

    if (this.flipped()) {
      if (event.key === '1') {
        event.preventDefault();
        void this.rateCurrentCard('again');
      } else if (event.key === '2') {
        event.preventDefault();
        void this.rateCurrentCard('hard');
      } else if (event.key === '3') {
        event.preventDefault();
        void this.rateCurrentCard('good');
      } else if (event.key === '4') {
        event.preventDefault();
        void this.rateCurrentCard('easy');
      }
    }
  }

  private resolveCardDirection(): void {
    const dir = this.direction();
    if (dir === 'normal') {
      this.cardReversed.set(false);
    } else if (dir === 'reverse') {
      this.cardReversed.set(true);
    } else {
      this.cardReversed.set(Math.random() < 0.5);
    }
  }

  private async finishSession(): Promise<void> {
    this.sessionFinished.set(true);
    this.flipped.set(false);

    // Bonus XP for finishing the queue
    await this.store.recordActivityXp(15);
    this.xpEarned.update((xp) => xp + 15);

    const elapsedMs = Date.now() - this.sessionStartedAt();
    const durationMinutes = Math.round(elapsedMs / 60_000);
    if (durationMinutes >= 1) {
      const block =
        this.blockFilter() === 'ALL'
          ? this.getDominantReviewedBlock()
          : (this.blockFilter() as TaiBlockId);
      await this.store.addStudySession({
        topicId: this.topicFilter(),
        blockId: block,
        durationMinutes,
        type: 'flashcards',
        notes: `Repaso SRS: ${this.reviewedTotal()} tarjetas${this.tagFilter() ? ` (#${this.tagFilter()})` : ''}`,
      });
    }
  }

  private getDominantReviewedBlock(): TaiBlockId {
    let best: TaiBlockId = 'B1';
    for (const id of ['B1', 'B2', 'B3', 'B4'] as TaiBlockId[]) {
      if (this.reviewedBlockCounts[id] > this.reviewedBlockCounts[best]) {
        best = id;
      }
    }
    return best;
  }
}
