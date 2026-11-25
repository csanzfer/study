import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { CreateFlashcardInput, StudyBlockId } from '../../../core/models/study.models';
import { StudyStoreService } from '../../../core/services/study-store.service';
import {
  TAI_ACRONYMS_SEED,
  TaiAcronymSeedItem,
  toAcronymFlashcardInput,
} from '../data/tai-acronyms-seed';
import {
  extractFlashcardsFromTopic,
  normalizeFlashcardKey,
  parseFlashcardsBatch,
} from '../utils/flashcard-import.util';

export type FlashcardImportTab = 'batch' | 'extract' | 'acronyms';

export interface FlashcardImportDialogData {
  initialTab?: FlashcardImportTab;
  blockId?: StudyBlockId;
  topicId?: string;
}

@Component({
  selector: 'app-flashcard-import-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './flashcard-import-dialog.html',
})
export class FlashcardImportDialog {
  private readonly dialogRef = inject(
    MatDialogRef<FlashcardImportDialog, CreateFlashcardInput[]>,
  );
  private readonly data = inject<FlashcardImportDialogData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });
  protected readonly store = inject(StudyStoreService);

  protected readonly activeTab = signal<FlashcardImportTab>(
    this.data?.initialTab ?? 'acronyms',
  );

  // Batch tab
  protected readonly batchBlockId = signal<StudyBlockId>(
    this.data?.blockId ?? this.store.defaultBlockId(),
  );
  protected readonly batchTopicId = signal<string>(this.data?.topicId ?? '');
  protected readonly batchDefaultTags = signal<string>('');
  protected readonly batchRawText = signal<string>('');

  protected readonly batchTopics = computed(() =>
    this.store.getTopicsForBlock(this.batchBlockId()),
  );

  protected readonly batchParsed = computed(() => {
    const tags = this.batchDefaultTags()
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    return parseFlashcardsBatch(
      this.batchRawText(),
      {
        blockId: this.batchBlockId(),
        topicId: this.batchTopicId() || undefined,
        tags,
      },
      this.store.flashcards(),
    );
  });

  // Extract from topic tab
  protected readonly extractTopicId = signal<string>(
    this.data?.topicId ?? this.store.topics()[0]?.id ?? '',
  );
  protected readonly selectedExtractedKeys = signal<Set<string>>(new Set());

  protected readonly extractedCandidates = computed(() => {
    const topic = this.store.getTopicById(this.extractTopicId());
    if (!topic) {
      return [];
    }
    return extractFlashcardsFromTopic(topic, this.store.flashcards());
  });

  // TAI Acronyms Pack tab
  protected readonly acronymBlockFilter = signal<'ALL' | StudyBlockId>('ALL');
  protected readonly deselectedAcronyms = signal<Set<string>>(new Set());

  private readonly existingFrontKeys = computed(
    () => new Set(this.store.flashcards().map((c) => normalizeFlashcardKey(c.front))),
  );

  protected readonly filteredAcronymSeed = computed(() => {
    const filter = this.acronymBlockFilter();
    const existing = this.existingFrontKeys();
    return TAI_ACRONYMS_SEED.filter((item) => filter === 'ALL' || item.blockId === filter).map(
      (item) => ({
        ...item,
        alreadyExists: existing.has(normalizeFlashcardKey(item.front)),
      }),
    );
  });

  protected readonly selectedAcronymInputs = computed(() => {
    const deselected = this.deselectedAcronyms();
    return this.filteredAcronymSeed()
      .filter((item) => !item.alreadyExists && !deselected.has(item.front))
      .map((item) => toAcronymFlashcardInput(item));
  });

  protected readonly canImport = computed(() => {
    const tab = this.activeTab();
    if (tab === 'batch') {
      return this.batchParsed().items.length > 0;
    }
    if (tab === 'extract') {
      return this.getSelectedExtractedItems().length > 0;
    }
    return this.selectedAcronymInputs().length > 0;
  });

  protected readonly importCount = computed(() => {
    const tab = this.activeTab();
    if (tab === 'batch') return this.batchParsed().items.length;
    if (tab === 'extract') return this.getSelectedExtractedItems().length;
    return this.selectedAcronymInputs().length;
  });

  constructor() {
    this.selectAllExtracted();
  }

  protected onExtractTopicChange(topicId: string): void {
    this.extractTopicId.set(topicId);
    this.selectAllExtracted();
  }

  protected selectAllExtracted(): void {
    const keys = new Set(
      this.extractedCandidates().map((item) => normalizeFlashcardKey(item.front)),
    );
    this.selectedExtractedKeys.set(keys);
  }

  protected toggleExtractedItem(front: string): void {
    const key = normalizeFlashcardKey(front);
    this.selectedExtractedKeys.update((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  protected isExtractedSelected(front: string): boolean {
    return this.selectedExtractedKeys().has(normalizeFlashcardKey(front));
  }

  protected toggleAcronymItem(item: TaiAcronymSeedItem): void {
    this.deselectedAcronyms.update((set) => {
      const next = new Set(set);
      if (next.has(item.front)) next.delete(item.front);
      else next.add(item.front);
      return next;
    });
  }

  protected isAcronymSelected(item: TaiAcronymSeedItem & { alreadyExists: boolean }): boolean {
    return !item.alreadyExists && !this.deselectedAcronyms().has(item.front);
  }

  protected confirmImport(): void {
    const tab = this.activeTab();
    if (tab === 'batch') {
      this.dialogRef.close(this.batchParsed().items);
      return;
    }
    if (tab === 'extract') {
      this.dialogRef.close(this.getSelectedExtractedItems());
      return;
    }
    this.dialogRef.close(this.selectedAcronymInputs());
  }

  private getSelectedExtractedItems(): CreateFlashcardInput[] {
    const selected = this.selectedExtractedKeys();
    return this.extractedCandidates().filter((item) =>
      selected.has(normalizeFlashcardKey(item.front)),
    );
  }
}
