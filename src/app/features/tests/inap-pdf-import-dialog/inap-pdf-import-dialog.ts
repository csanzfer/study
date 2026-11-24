import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import {
  CreateCaseStudyInput,
  CreateQuestionInput,
  QuestionOptionIndex,
  TaiBlockId,
} from '../../../core/models/study.models';
import { StudyStoreService } from '../../../core/services/study-store.service';
import { PdfTextExtractorService } from '../services/pdf-text-extractor.service';
import {
  InapImportMode,
  ParsedInapQuestion,
  applyInapAnswerKey,
  inferInapMetadataFromFilename,
  normalizePromptForDuplicateCheck,
  parseInapAnswerKeyText,
  parseInapQuestionnaireText,
} from '../utils/inap-pdf-parser.util';
import { OPTION_LETTERS } from '../utils/test-scoring.util';

export interface InapPdfImportDialogData {
  defaultBlockId?: TaiBlockId;
}

export interface InapPdfImportDialogResult {
  caseStudy?: CreateCaseStudyInput;
  questions: CreateQuestionInput[];
}

type ReviewFilter = 'all' | 'issues' | 'selected';

@Component({
  selector: 'app-inap-pdf-import-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './inap-pdf-import-dialog.html',
})
export class InapPdfImportDialog {
  private readonly dialogRef = inject(
    MatDialogRef<InapPdfImportDialog, InapPdfImportDialogResult>,
  );
  protected readonly data =
    inject<InapPdfImportDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  protected readonly store = inject(StudyStoreService);
  private readonly pdfExtractor = inject(PdfTextExtractorService);

  protected readonly questionnaireInput = viewChild<ElementRef<HTMLInputElement>>('questionnaireInput');
  protected readonly answerKeyInput = viewChild<ElementRef<HTMLInputElement>>('answerKeyInput');

  protected readonly letters = OPTION_LETTERS;
  protected readonly step = signal<1 | 2>(1);
  protected readonly mode = signal<InapImportMode>('questionnaire');
  protected readonly defaultBlockId = signal<TaiBlockId>(this.data.defaultBlockId ?? 'B1');
  protected readonly source = signal('');
  protected readonly tagsText = signal('inap');
  protected readonly caseStudyTitle = signal('');
  protected readonly caseStudyStatement = signal('');
  protected readonly skipDuplicates = signal(true);

  protected readonly questionnaireFileName = signal('');
  protected readonly questionnairePageCount = signal(0);
  protected readonly questionnaireRawText = signal('');

  protected readonly answerKeyFileName = signal('');
  protected readonly answerKeyRawText = signal('');

  protected readonly extractingPdf = signal(false);
  protected readonly extractionError = signal<string | null>(null);
  protected readonly globalWarnings = signal<string[]>([]);
  protected readonly parsedQuestions = signal<ParsedInapQuestion[]>([]);
  protected readonly reviewFilter = signal<ReviewFilter>('all');

  private readonly existingPromptsSet = computed(
    () =>
      new Set(
        this.store.questions().map((q) => normalizePromptForDuplicateCheck(q.prompt)),
      ),
  );

  protected readonly duplicateIds = computed(() => {
    const existing = this.existingPromptsSet();
    const ids = new Set<string>();
    for (const q of this.parsedQuestions()) {
      const normalized = normalizePromptForDuplicateCheck(q.prompt);
      if (normalized && existing.has(normalized)) {
        ids.add(q.id);
      }
    }
    return ids;
  });

  protected readonly filteredQuestions = computed(() => {
    const filter = this.reviewFilter();
    const list = this.parsedQuestions();
    if (filter === 'issues') {
      return list.filter((q) => q.warnings.length > 0 || q.correctIndex === null || q.isAnnulled);
    }
    if (filter === 'selected') {
      return list.filter((q) => q.selected);
    }
    return list;
  });

  protected readonly importableQuestions = computed(() => {
    const skipDups = this.skipDuplicates();
    const dups = this.duplicateIds();
    return this.parsedQuestions().filter((q) => {
      if (!q.selected || q.correctIndex === null) return false;
      if (!q.prompt.trim() || q.options.some((opt) => !opt.trim())) return false;
      if (skipDups && dups.has(q.id)) return false;
      return true;
    });
  });

  protected readonly missingAnswerCount = computed(
    () => this.parsedQuestions().filter((q) => q.correctIndex === null && !q.isAnnulled).length,
  );

  protected readonly annulledCount = computed(
    () => this.parsedQuestions().filter((q) => q.isAnnulled).length,
  );

  protected triggerQuestionnaireSelect(): void {
    this.questionnaireInput()?.nativeElement.click();
  }

  protected triggerAnswerKeySelect(): void {
    this.answerKeyInput()?.nativeElement.click();
  }

  protected async onQuestionnaireFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.extractingPdf.set(true);
    this.extractionError.set(null);

    try {
      const result = await this.pdfExtractor.extractTextFromPdfFile(file);
      this.questionnaireFileName.set(file.name);
      this.questionnairePageCount.set(result.pageCount);
      this.questionnaireRawText.set(result.text);

      const inferred = inferInapMetadataFromFilename(file.name);
      if (!this.source().trim()) {
        this.source.set(inferred.source);
      }
      this.tagsText.set(inferred.tags.join(', '));
      if (this.mode() === 'case_study' && !this.caseStudyTitle().trim()) {
        this.caseStudyTitle.set(inferred.source);
      }
    } catch (err) {
      this.extractionError.set(
        err instanceof Error
          ? `No se pudo leer el PDF: ${err.message}`
          : 'No se pudo extraer texto del PDF seleccionado.',
      );
    } finally {
      this.extractingPdf.set(false);
    }
  }

  protected async onAnswerKeyFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.extractingPdf.set(true);
    this.extractionError.set(null);

    try {
      const result = await this.pdfExtractor.extractTextFromPdfFile(file);
      this.answerKeyFileName.set(file.name);
      this.answerKeyRawText.set(result.text);
    } catch (err) {
      this.extractionError.set(
        err instanceof Error
          ? `No se pudo leer la plantilla PDF: ${err.message}`
          : 'No se pudo extraer texto de la plantilla PDF.',
      );
    } finally {
      this.extractingPdf.set(false);
    }
  }

  protected analyzeAndContinue(): void {
    const rawQuestionnaire = this.questionnaireRawText().trim();
    if (!rawQuestionnaire) {
      this.extractionError.set('Sube el PDF del cuestionario o pega su texto para continuar.');
      return;
    }

    this.extractionError.set(null);
    const parsed = parseInapQuestionnaireText(rawQuestionnaire, {
      defaultBlockId: this.defaultBlockId(),
      mode: this.mode(),
    });

    let questions = parsed.questions;
    const warnings = [...parsed.warnings];

    const rawAnswerKey = this.answerKeyRawText().trim();
    if (rawAnswerKey) {
      const keyMap = parseInapAnswerKeyText(rawAnswerKey);
      if (keyMap.size === 0) {
        warnings.push(
          'No se reconocieron pares número-letra en la plantilla de respuestas. Puedes marcar las respuestas manualmente.',
        );
      } else {
        const merged = applyInapAnswerKey(questions, keyMap);
        questions = merged.questions;
      }
    }

    this.parsedQuestions.set(questions);
    this.globalWarnings.set(warnings);
    if (this.mode() === 'case_study') {
      this.caseStudyStatement.set(parsed.caseStudyStatement ?? '');
      if (!this.caseStudyTitle().trim()) {
        this.caseStudyTitle.set(this.source().trim() || 'Supuesto práctico INAP');
      }
    }
    this.step.set(2);
  }

  protected updateQuestion(id: string, patch: Partial<ParsedInapQuestion>): void {
    this.parsedQuestions.update((list) =>
      list.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    );
  }

  protected updateOption(id: string, index: QuestionOptionIndex, value: string): void {
    this.parsedQuestions.update((list) =>
      list.map((q) => {
        if (q.id !== id) return q;
        const nextOptions: [string, string, string, string] = [...q.options] as [
          string,
          string,
          string,
          string,
        ];
        nextOptions[index] = value;
        return { ...q, options: nextOptions };
      }),
    );
  }

  protected setCorrectOption(id: string, index: QuestionOptionIndex): void {
    this.parsedQuestions.update((list) =>
      list.map((q) =>
        q.id === id
          ? {
              ...q,
              correctIndex: index,
              isAnnulled: false,
              selected: true,
              warnings: q.warnings.filter((w) => !w.includes('Sin respuesta') && !w.includes('anulada')),
            }
          : q,
      ),
    );
  }

  protected selectAllValid(): void {
    this.parsedQuestions.update((list) =>
      list.map((q) => ({
        ...q,
        selected:
          !q.isAnnulled &&
          q.correctIndex !== null &&
          q.prompt.trim().length > 0 &&
          q.options.every((opt) => opt.trim().length > 0),
      })),
    );
  }

  protected deselectAll(): void {
    this.parsedQuestions.update((list) => list.map((q) => ({ ...q, selected: false })));
  }

  protected confirmImport(): void {
    const ready = this.importableQuestions();
    if (ready.length === 0) return;

    const baseTags = Array.from(
      new Set(
        this.tagsText()
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      ),
    );
    const cleanSource = this.source().trim() || undefined;

    const questions: CreateQuestionInput[] = ready.map((q) => {
      const tags = q.isReserve ? Array.from(new Set([...baseTags, 'reserva'])) : baseTags;
      return {
        blockId: q.blockId,
        prompt: q.prompt.trim(),
        options: [
          q.options[0].trim(),
          q.options[1].trim(),
          q.options[2].trim(),
          q.options[3].trim(),
        ],
        correctIndex: q.correctIndex as QuestionOptionIndex,
        source: cleanSource,
        reference: `Pregunta ${q.numberLabel}`,
        tags,
      };
    });

    let caseStudy: CreateCaseStudyInput | undefined;
    if (this.mode() === 'case_study' && this.caseStudyStatement().trim()) {
      caseStudy = {
        blockId: this.defaultBlockId(),
        title: this.caseStudyTitle().trim() || cleanSource || 'Supuesto práctico INAP',
        statement: this.caseStudyStatement().trim(),
        source: cleanSource,
        tags: baseTags,
      };
    }

    this.dialogRef.close({ caseStudy, questions });
  }
}
