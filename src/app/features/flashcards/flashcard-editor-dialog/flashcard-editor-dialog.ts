import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import {
  CreateFlashcardInput,
  FLASHCARD_SUGGESTED_TAGS,
  Flashcard,
  StudyBlockId,
} from '../../../core/models/study.models';
import { StudyStoreService } from '../../../core/services/study-store.service';
import { parseSelectedTextToFlashcardDraft } from '../utils/flashcard-import.util';

export interface FlashcardEditorDialogData {
  flashcard?: Flashcard;
  blockId?: StudyBlockId;
  topicId?: string;
  selectedText?: string;
  initialTags?: string[];
  mode?: 'standard' | 'acronym';
}

@Component({
  selector: 'app-flashcard-editor-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './flashcard-editor-dialog.html',
})
export class FlashcardEditorDialog {
  private readonly dialogRef = inject(MatDialogRef<FlashcardEditorDialog, CreateFlashcardInput>);
  private readonly data = inject<FlashcardEditorDialogData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });
  protected readonly store = inject(StudyStoreService);

  protected readonly isEditMode = Boolean(this.data?.flashcard);
  protected readonly suggestedTags = FLASHCARD_SUGGESTED_TAGS;

  protected readonly cardMode = signal<'standard' | 'acronym'>('standard');
  protected readonly blockId = signal<StudyBlockId>(this.store.defaultBlockId());
  protected readonly topicId = signal<string>('');
  protected readonly front = signal('');
  protected readonly back = signal('');
  protected readonly hint = signal('');
  protected readonly tags = signal<string[]>([]);
  protected readonly tagInput = signal('');

  protected readonly availableTopics = computed(() =>
    this.store.getTopicsForBlock(this.blockId()),
  );

  protected readonly canSave = computed(
    () =>
      this.blockId().length > 0 &&
      this.front().trim().length > 0 &&
      this.back().trim().length > 0,
  );

  constructor() {
    const existing = this.data?.flashcard;
    if (existing) {
      this.blockId.set(existing.blockId);
      this.topicId.set(existing.topicId ?? '');
      this.front.set(existing.front);
      this.back.set(existing.back);
      this.hint.set(existing.hint ?? '');
      this.tags.set([...existing.tags]);
      this.cardMode.set(
        existing.tags.some((t) => t.toLowerCase() === 'siglas') ? 'acronym' : 'standard',
      );
      return;
    }

    if (this.data?.blockId) {
      this.blockId.set(this.data.blockId);
    }
    if (this.data?.topicId) {
      this.topicId.set(this.data.topicId);
    }

    const baseTags = new Set<string>((this.data?.initialTags ?? []).filter(Boolean));

    if (this.data?.selectedText) {
      const draft = parseSelectedTextToFlashcardDraft(this.data.selectedText);
      this.front.set(draft.front);
      this.back.set(draft.back);
      if (draft.isAcronym) {
        this.cardMode.set('acronym');
        baseTags.add('siglas');
      }
    }

    if (this.data?.mode === 'acronym') {
      this.cardMode.set('acronym');
      baseTags.add('siglas');
    }

    this.tags.set(Array.from(baseTags));
  }

  protected setCardMode(mode: 'standard' | 'acronym'): void {
    this.cardMode.set(mode);
    if (mode === 'acronym' && !this.tags().includes('siglas')) {
      this.tags.update((list) => ['siglas', ...list]);
    }
  }

  protected onBlockChange(nextBlock: StudyBlockId): void {
    this.blockId.set(nextBlock);
    const validTopics = this.store.getTopicsForBlock(nextBlock);
    if (!validTopics.some((t) => t.id === this.topicId())) {
      this.topicId.set('');
    }
  }

  protected swapSides(): void {
    const currentFront = this.front();
    this.front.set(this.back());
    this.back.set(currentFront);
  }

  protected toggleSuggestedTag(tag: string): void {
    if (this.tags().includes(tag)) {
      this.tags.update((list) => list.filter((item) => item !== tag));
    } else {
      this.tags.update((list) => [...list, tag]);
    }
  }

  protected addCustomTag(): void {
    const raw = this.tagInput().trim();
    if (!raw) {
      return;
    }
    const incoming = raw
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    this.tags.update((list) => Array.from(new Set([...list, ...incoming])));
    this.tagInput.set('');
  }

  protected removeTag(tag: string): void {
    this.tags.update((list) => list.filter((item) => item !== tag));
  }

  protected save(): void {
    if (!this.canSave()) {
      return;
    }

    const finalTags = Array.from(
      new Set(
        this.cardMode() === 'acronym' ? ['siglas', ...this.tags()] : this.tags(),
      ),
    );

    this.dialogRef.close({
      blockId: this.blockId(),
      topicId: this.topicId() || undefined,
      front: this.front().trim(),
      back: this.back().trim(),
      hint: this.hint().trim() || undefined,
      tags: finalTags,
    });
  }
}
