import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { CreateFlashcardInput, TaiBlockId } from '../../../core/models/study.models';
import { StudyStoreService } from '../../../core/services/study-store.service';
import { CampaignMap } from '../campaign-map/campaign-map';
import { FlashcardDeckManager } from '../flashcard-deck-manager/flashcard-deck-manager';
import {
  FlashcardImportDialog,
  FlashcardImportDialogData,
  FlashcardImportTab,
} from '../flashcard-import-dialog/flashcard-import-dialog';
import { FlashcardReviewSession } from '../flashcard-review-session/flashcard-review-session';
import { MissionsStreakPanel } from '../missions-streak-panel/missions-streak-panel';

export type FlashcardsTab = 'review' | 'deck' | 'campaign' | 'missions';

@Component({
  selector: 'app-flashcards-page',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatSnackBarModule,
    FlashcardReviewSession,
    FlashcardDeckManager,
    CampaignMap,
    MissionsStreakPanel,
  ],
  templateUrl: './flashcards-page.html',
})
export class FlashcardsPage {
  protected readonly store = inject(StudyStoreService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  private readonly queryState = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => {
        const rawTab = params.get('tab');
        const tab: FlashcardsTab =
          rawTab === 'deck' || rawTab === 'campaign' || rawTab === 'missions'
            ? rawTab
            : 'review';
        const rawBlock = params.get('blockId');
        const blockId: 'ALL' | TaiBlockId =
          rawBlock === 'B1' || rawBlock === 'B2' || rawBlock === 'B3' || rawBlock === 'B4'
            ? rawBlock
            : 'ALL';
        return {
          tab,
          blockId,
          topicId: params.get('topicId') ?? '',
          tag: params.get('tag') ?? '',
        };
      }),
    ),
    {
      initialValue: {
        tab: 'review' as FlashcardsTab,
        blockId: 'ALL' as 'ALL' | TaiBlockId,
        topicId: '',
        tag: '',
      },
    },
  );

  protected readonly activeTab = computed(() => this.queryState().tab);
  protected readonly reviewBlockId = signal<'ALL' | TaiBlockId>('ALL');
  protected readonly reviewTopicId = signal<string>('');
  protected readonly reviewTag = signal<string>('');

  protected readonly effectiveBlockId = computed(() =>
    this.queryState().blockId !== 'ALL' ? this.queryState().blockId : this.reviewBlockId(),
  );
  protected readonly effectiveTopicId = computed(() =>
    this.queryState().topicId || this.reviewTopicId(),
  );
  protected readonly effectiveTag = computed(() =>
    this.queryState().tag || this.reviewTag(),
  );

  protected setTab(tab: FlashcardsTab): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
    });
  }

  protected async openImportDialog(initialTab: FlashcardImportTab = 'acronyms'): Promise<void> {
    const ref = this.dialog.open<
      FlashcardImportDialog,
      FlashcardImportDialogData,
      CreateFlashcardInput[]
    >(FlashcardImportDialog, {
      width: '780px',
      maxWidth: '96vw',
      data: { initialTab },
    });

    const items = await firstValueFrom(ref.afterClosed());
    if (!items || items.length === 0) {
      return;
    }

    await this.store.bulkCreateFlashcards(items);
    this.snackBar.open(
      `${items.length} flashcard${items.length === 1 ? '' : 's'} añadida${items.length === 1 ? '' : 's'} al mazo.`,
      'Cerrar',
      { duration: 3200 },
    );
  }

  protected onStartReviewWithFilter(filter: {
    blockId: 'ALL' | TaiBlockId;
    topicId: string;
    tag: string;
  }): void {
    this.reviewBlockId.set(filter.blockId);
    this.reviewTopicId.set(filter.topicId);
    this.reviewTag.set(filter.tag);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        tab: 'review',
        blockId: filter.blockId === 'ALL' ? null : filter.blockId,
        topicId: filter.topicId || null,
        tag: filter.tag || null,
      },
    });
  }
}
