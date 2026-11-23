import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import {
  CreateFlashcardInput,
  Flashcard,
  TAI_FLASHCARD_SUGGESTED_TAGS,
  TaiBlockId,
} from '../../../core/models/study.models';
import { StudyStoreService } from '../../../core/services/study-store.service';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog';
import {
  FlashcardMaturity,
  getFlashcardMaturity,
  isFlashcardDue,
} from '../../../shared/utils/srs-sm2.util';
import {
  FlashcardEditorDialog,
  FlashcardEditorDialogData,
} from '../flashcard-editor-dialog/flashcard-editor-dialog';
import { FlashcardImportTab } from '../flashcard-import-dialog/flashcard-import-dialog';

export type DeckStatusFilter = 'all' | 'due' | FlashcardMaturity;

@Component({
  selector: 'app-flashcard-deck-manager',
  imports: [FormsModule, MatButtonModule, MatIconModule],
  templateUrl: './flashcard-deck-manager.html',
})
export class FlashcardDeckManager {
  protected readonly store = inject(StudyStoreService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly openImportRequest = output<FlashcardImportTab>();
  readonly startReviewWithFilter = output<{
    blockId: 'ALL' | TaiBlockId;
    topicId: string;
    tag: string;
  }>();

  protected readonly quickTags = TAI_FLASHCARD_SUGGESTED_TAGS;

  protected readonly searchText = signal('');
  protected readonly blockFilter = signal<'ALL' | TaiBlockId>('ALL');
  protected readonly topicFilter = signal<string>('ALL');
  protected readonly tagFilter = signal<string>('');
  protected readonly statusFilter = signal<DeckStatusFilter>('all');

  protected readonly availableTopics = computed(() => {
    const block = this.blockFilter();
    return block === 'ALL' ? this.store.topics() : this.store.getTopicsForBlock(block);
  });

  protected readonly filteredCards = computed(() => {
    const query = this.searchText().trim().toLowerCase();
    const block = this.blockFilter();
    const topic = this.topicFilter();
    const tag = this.tagFilter().trim().toLowerCase();
    const status = this.statusFilter();
    const today = new Date();

    return this.store.flashcards().filter((card) => {
      if (block !== 'ALL' && card.blockId !== block) return false;
      if (topic !== 'ALL' && card.topicId !== topic) return false;
      if (tag && !card.tags.some((t) => t.toLowerCase() === tag)) return false;
      if (status === 'due' && !isFlashcardDue(card, today)) return false;
      if (
        (status === 'new' || status === 'learning' || status === 'mastered') &&
        getFlashcardMaturity(card) !== status
      ) {
        return false;
      }
      if (query) {
        const hay = `${card.front} ${card.back} ${card.hint ?? ''} ${card.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  });

  protected onBlockFilterChange(next: 'ALL' | TaiBlockId): void {
    this.blockFilter.set(next);
    this.topicFilter.set('ALL');
  }

  protected getMaturityBadge(card: Flashcard): { label: string; cssClass: string } {
    const today = new Date();
    const maturity = getFlashcardMaturity(card);
    if (maturity === 'mastered') {
      return {
        label: `Dominada (${card.srs.intervalDays}d)`,
        cssClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
      };
    }
    if (isFlashcardDue(card, today)) {
      return {
        label: maturity === 'new' ? 'Nueva · Vencida' : 'Vencida hoy',
        cssClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
      };
    }
    return {
      label: `Próx.: ${card.srs.dueDate}`,
      cssClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    };
  }

  protected getTopicTitle(topicId?: string): string | null {
    if (!topicId) return null;
    return this.store.getTopicById(topicId)?.title ?? null;
  }

  protected async openCreateDialog(mode: 'standard' | 'acronym' = 'standard'): Promise<void> {
    const ref = this.dialog.open<
      FlashcardEditorDialog,
      FlashcardEditorDialogData,
      CreateFlashcardInput
    >(FlashcardEditorDialog, {
      width: '620px',
      maxWidth: '95vw',
      data: {
        mode,
        blockId: this.blockFilter() === 'ALL' ? 'B1' : (this.blockFilter() as TaiBlockId),
        topicId: this.topicFilter() === 'ALL' ? undefined : this.topicFilter(),
      },
    });

    const input = await firstValueFrom(ref.afterClosed());
    if (!input) return;

    await this.store.createFlashcard(input);
    this.snackBar.open('Flashcard creada.', 'Cerrar', { duration: 2200 });
  }

  protected async openEditDialog(card: Flashcard): Promise<void> {
    const ref = this.dialog.open<
      FlashcardEditorDialog,
      FlashcardEditorDialogData,
      CreateFlashcardInput
    >(FlashcardEditorDialog, {
      width: '620px',
      maxWidth: '95vw',
      data: { flashcard: card },
    });

    const patch = await firstValueFrom(ref.afterClosed());
    if (!patch) return;

    await this.store.updateFlashcard(card.id, patch);
    this.snackBar.open('Flashcard actualizada.', 'Cerrar', { duration: 2200 });
  }

  protected async deleteCard(card: Flashcard): Promise<void> {
    const ref = this.dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
      data: {
        title: 'Eliminar flashcard',
        message: `¿Seguro que quieres eliminar la tarjeta "${card.front.slice(0, 60)}"?`,
        confirmLabel: 'Eliminar',
        cancelLabel: 'Cancelar',
        danger: true,
      },
    });

    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    await this.store.deleteFlashcard(card.id);
    this.snackBar.open('Flashcard eliminada.', 'Cerrar', { duration: 2000 });
  }
}
