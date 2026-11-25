import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  BLOCK_COLOR_PRESETS,
  BLOCK_ICON_PRESETS,
  CreateBlockInput,
  DEFAULT_BLOCK_COLOR,
  StudyBlock,
} from '../../../core/models/study.models';

export interface BlockEditorDialogData {
  block?: StudyBlock;
}

const CODE_STOPWORDS = new Set([
  'a',
  'al',
  'con',
  'de',
  'del',
  'e',
  'el',
  'en',
  'la',
  'las',
  'los',
  'o',
  'para',
  'por',
  'u',
  'y',
]);

export function suggestBlockCode(title: string): string {
  const clean = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim();

  if (!clean) {
    return '';
  }

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 4).toUpperCase();
  }

  const significant = words.filter((w) => !CODE_STOPWORDS.has(w.toLowerCase()));
  const source = significant.length >= 2 ? significant : words;
  return source
    .slice(0, 4)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

@Component({
  selector: 'app-block-editor-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatIconModule, MatTooltipModule],
  templateUrl: './block-editor-dialog.html',
})
export class BlockEditorDialog {
  private readonly dialogRef = inject(MatDialogRef<BlockEditorDialog, CreateBlockInput>);
  protected readonly data =
    inject<BlockEditorDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};

  protected readonly colorPresets = BLOCK_COLOR_PRESETS;
  protected readonly iconPresets = BLOCK_ICON_PRESETS;
  protected readonly isEdit = Boolean(this.data.block);

  protected readonly title = signal(this.data.block?.title ?? '');
  protected readonly code = signal(this.data.block?.code ?? '');
  protected readonly shortTitle = signal(
    this.data.block && this.data.block.shortTitle !== this.data.block.title
      ? this.data.block.shortTitle
      : '',
  );
  protected readonly description = signal(this.data.block?.description ?? '');
  protected readonly color = signal(this.data.block?.color ?? DEFAULT_BLOCK_COLOR);
  protected readonly icon = signal(this.data.block?.icon ?? BLOCK_ICON_PRESETS[0].name);

  private codeTouched = Boolean(this.data.block);

  protected readonly canSave = computed(
    () => this.title().trim().length > 0 && this.code().trim().length > 0,
  );

  protected onTitleChange(nextTitle: string): void {
    this.title.set(nextTitle);
    if (!this.codeTouched) {
      this.code.set(suggestBlockCode(nextTitle));
    }
  }

  protected onCodeChange(nextCode: string): void {
    this.codeTouched = nextCode.trim().length > 0;
    this.code.set(nextCode);
  }

  protected save(): void {
    if (!this.canSave()) {
      return;
    }

    const trimmedTitle = this.title().trim();
    this.dialogRef.close({
      code: this.code().trim(),
      title: trimmedTitle,
      shortTitle: this.shortTitle().trim() || trimmedTitle,
      description: this.description().trim(),
      color: this.color(),
      icon: this.icon(),
    });
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}
