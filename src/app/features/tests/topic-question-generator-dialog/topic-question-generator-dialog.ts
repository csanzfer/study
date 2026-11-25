import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { CreateQuestionInput, StudyBlockId } from '../../../core/models/study.models';
import { StudyStoreService } from '../../../core/services/study-store.service';
import {
  parseQuestionsFromJson,
  parseQuestionsFromText,
} from '../utils/question-import.util';
import { OPTION_LETTERS } from '../utils/test-scoring.util';
import {
  GeneratedQuestionDraft,
  buildAiPromptForTopic,
  generateQuestionsFromTopic,
  stripMarkdownCodeFence,
} from '../utils/topic-question-generator.util';

export interface TopicQuestionGeneratorDialogData {
  topicId?: string;
  blockId?: StudyBlockId;
}

type GeneratorTab = 'local' | 'ai_prompt';

interface SelectableDraft {
  id: number;
  selected: boolean;
  draft: GeneratedQuestionDraft;
}

@Component({
  selector: 'app-topic-question-generator-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './topic-question-generator-dialog.html',
})
export class TopicQuestionGeneratorDialog {
  private readonly dialogRef = inject(
    MatDialogRef<TopicQuestionGeneratorDialog, CreateQuestionInput[]>,
  );
  protected readonly data =
    inject<TopicQuestionGeneratorDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  protected readonly store = inject(StudyStoreService);

  protected readonly letters = OPTION_LETTERS;
  protected readonly activeTab = signal<GeneratorTab>('local');

  protected readonly selectedTopicId = signal<string>(this.resolveInitialTopicId());
  protected readonly localDrafts = signal<SelectableDraft[]>([]);
  protected readonly maxLocalQuestions = signal(15);

  // Tab 2: AI Prompt Builder
  protected readonly aiQuestionCount = signal(10);
  protected readonly aiDifficulty = signal<'standard' | 'hard'>('standard');
  protected readonly aiFocusCallouts = signal(true);
  protected readonly copiedPrompt = signal(false);
  protected readonly aiResponseText = signal('');

  protected readonly selectedTopic = computed(() =>
    this.store.getTopicById(this.selectedTopicId()),
  );

  protected readonly selectedLocalCount = computed(
    () => this.localDrafts().filter((d) => d.selected).length,
  );

  protected readonly aiPromptResult = computed(() => {
    const topic = this.selectedTopic();
    if (!topic) return null;
    const block = this.store.getBlockById(topic.blockId);
    return buildAiPromptForTopic(topic, {
      blockCode: block?.code,
      questionCount: this.aiQuestionCount(),
      difficulty: this.aiDifficulty(),
      focusCallouts: this.aiFocusCallouts(),
    });
  });

  protected readonly aiParsedResult = computed(() => {
    const topic = this.selectedTopic();
    const raw = stripMarkdownCodeFence(this.aiResponseText());
    if (!topic || !raw) {
      return { valid: [], errors: [] };
    }

    const defaults = {
      defaultBlockId: topic.blockId,
      defaultTopicId: topic.id,
      defaultSource: `IA · ${topic.title}`,
      topics: this.store.topics(),
    };

    if (raw.startsWith('[') || raw.startsWith('{')) {
      return parseQuestionsFromJson(raw, defaults);
    }
    return parseQuestionsFromText(raw, defaults);
  });

  protected readonly readyToSaveCount = computed(() =>
    this.activeTab() === 'local'
      ? this.selectedLocalCount()
      : this.aiParsedResult().valid.length,
  );

  constructor() {
    effect(() => {
      const topic = this.selectedTopic();
      const limit = this.maxLocalQuestions();
      if (!topic) {
        this.localDrafts.set([]);
        return;
      }
      const generated = generateQuestionsFromTopic(topic, { maxQuestions: limit });
      this.localDrafts.set(
        generated.map((draft, idx) => ({
          id: idx,
          selected: true,
          draft,
        })),
      );
    });
  }

  protected regenerateLocal(): void {
    const topic = this.selectedTopic();
    if (!topic) return;
    const generated = generateQuestionsFromTopic(topic, {
      maxQuestions: this.maxLocalQuestions(),
    });
    this.localDrafts.set(
      generated.map((draft, idx) => ({
        id: idx,
        selected: true,
        draft,
      })),
    );
  }

  protected toggleDraftSelection(id: number): void {
    this.localDrafts.update((list) =>
      list.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item,
      ),
    );
  }

  protected updateDraftPrompt(id: number, nextPrompt: string): void {
    this.localDrafts.update((list) =>
      list.map((item) =>
        item.id === id
          ? { ...item, draft: { ...item.draft, prompt: nextPrompt } }
          : item,
      ),
    );
  }

  protected toggleSelectAllLocal(selected: boolean): void {
    this.localDrafts.update((list) => list.map((item) => ({ ...item, selected })));
  }

  protected async copyPrompt(): Promise<void> {
    const prompt = this.aiPromptResult()?.prompt;
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      this.copiedPrompt.set(true);
      setTimeout(() => this.copiedPrompt.set(false), 2500);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  }

  protected confirmSave(): void {
    if (this.activeTab() === 'local') {
      const chosen = this.localDrafts()
        .filter((d) => d.selected && d.draft.prompt.trim().length > 0)
        .map((d): CreateQuestionInput => {
          const { strategy: _s, strategyLabel: _sl, ...input } = d.draft;
          return { ...input, prompt: input.prompt.trim() };
        });
      if (chosen.length === 0) return;
      this.dialogRef.close(chosen);
    } else {
      const valid = this.aiParsedResult().valid;
      if (valid.length === 0) return;
      this.dialogRef.close(valid);
    }
  }

  private resolveInitialTopicId(): string {
    if (this.data.topicId && this.store.getTopicById(this.data.topicId)) {
      return this.data.topicId;
    }
    if (this.data.blockId) {
      const blockTopics = this.store.getTopicsForBlock(this.data.blockId);
      if (blockTopics.length > 0) return blockTopics[0].id;
    }
    return this.store.topics()[0]?.id ?? '';
  }
}
