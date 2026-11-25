import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import {
  EXAM_MODE_LABELS,
  ExamMode,
  PENALTY_PRESETS,
  StudyBlockId,
} from '../../../core/models/study.models';
import { StudyStoreService } from '../../../core/services/study-store.service';
import { TestRunnerService } from '../services/test-runner.service';
import { MistakesFilter, generateTestQuestions } from '../utils/test-generator.util';

interface ModeOption {
  id: ExamMode;
  title: string;
  subtitle: string;
  icon: string;
  accentClass: string;
}

@Component({
  selector: 'app-test-launcher',
  imports: [FormsModule, MatButtonModule, MatIconModule, MatSnackBarModule],
  templateUrl: './test-launcher.html',
})
export class TestLauncher {
  protected readonly store = inject(StudyStoreService);
  private readonly runner = inject(TestRunnerService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  readonly initialMode = input<ExamMode | null>(null);
  readonly initialBlockId = input<StudyBlockId | null>(null);
  readonly initialTopicId = input<string | null>(null);

  protected readonly penaltyPresets = PENALTY_PRESETS;
  protected readonly modeLabels = EXAM_MODE_LABELS;

  protected readonly modes: ModeOption[] = [
    {
      id: 'practice',
      title: 'Práctica por tema o bloque',
      subtitle: 'Corrección inmediata con explicación y referencia.',
      icon: 'school',
      accentClass: 'text-cyan-600 dark:text-cyan-400',
    },
    {
      id: 'simulation',
      title: 'Simulacro de examen',
      subtitle: 'Cronómetro, reparto por bloques, opción en blanco y penalización configurable.',
      icon: 'assignment',
      accentClass: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      id: 'mistakes',
      title: 'Repaso inteligente de fallos',
      subtitle: 'Prioriza tus preguntas falladas y marcadas con bandera.',
      icon: 'psychology',
      accentClass: 'text-rose-600 dark:text-rose-400',
    },
    {
      id: 'case_study',
      title: 'Supuesto práctico',
      subtitle: 'Vista dividida con enunciado común fijo y batería de preguntas.',
      icon: 'article',
      accentClass: 'text-violet-600 dark:text-violet-400',
    },
  ];

  protected readonly selectedMode = signal<ExamMode>('practice');
  protected readonly selectedBlock = signal<StudyBlockId | 'ALL'>('ALL');
  protected readonly selectedTopicId = signal<string>('ALL');
  protected readonly questionCount = signal(20);
  protected readonly onlyUnanswered = signal(false);
  protected readonly shuffle = signal(true);
  protected readonly penaltyRatio = signal<number>(1 / 3);

  // Simulation settings
  protected readonly timeLimitMinutes = signal<number>(90);
  protected readonly blockQuotas = signal<Record<StudyBlockId, number>>({});

  // Mistakes settings
  protected readonly mistakesFilter = signal<MistakesFilter>('both');

  // Case study settings
  protected readonly selectedCaseStudyId = signal<string>('');
  protected readonly caseStudyImmediateFeedback = signal(false);

  constructor() {
    effect(() => {
      const m = this.initialMode();
      if (m) this.selectedMode.set(m);
    });
    effect(() => {
      const b = this.initialBlockId();
      if (b) this.selectedBlock.set(b);
    });
    effect(() => {
      const t = this.initialTopicId();
      if (t) {
        const topic = this.store.getTopicById(t);
        if (topic) {
          this.selectedBlock.set(topic.blockId);
          this.selectedTopicId.set(topic.id);
        }
      }
    });
    effect(() => {
      const blocks = this.store.blocks();
      const counts = this.store.questionCountByBlock();
      this.blockQuotas.update((current) => {
        const next: Record<StudyBlockId, number> = {};
        let changed = Object.keys(current).length !== blocks.length;
        for (const block of blocks) {
          if (block.id in current) {
            next[block.id] = current[block.id];
          } else {
            const available = counts[block.id] ?? 0;
            next[block.id] = available > 0 ? Math.min(20, available) : 0;
            changed = true;
          }
        }
        return changed ? next : current;
      });
    });
  }

  protected readonly availableTopics = computed(() => {
    const block = this.selectedBlock();
    return block === 'ALL' ? this.store.topics() : this.store.getTopicsForBlock(block);
  });

  protected readonly previewResult = computed(() => {
    const mode = this.selectedMode();
    const block = this.selectedBlock();
    const blockIds = block === 'ALL' ? undefined : [block];
    const topicId = this.selectedTopicId() === 'ALL' ? undefined : this.selectedTopicId();

    return generateTestQuestions(this.store.questions(), {
      mode,
      blockIds,
      topicId,
      caseStudyId: this.selectedCaseStudyId() || undefined,
      questionCount: this.questionCount(),
      blockQuotas: mode === 'simulation' ? this.blockQuotas() : undefined,
      mistakesFilter: this.mistakesFilter(),
      onlyUnanswered: this.onlyUnanswered(),
      shuffle: false,
    });
  });

  protected readonly canLaunch = computed(() => this.previewResult().questions.length > 0);

  protected onBlockChange(next: StudyBlockId | 'ALL'): void {
    this.selectedBlock.set(next);
    this.selectedTopicId.set('ALL');
  }

  protected setBlockQuota(blockId: StudyBlockId, value: number): void {
    const safe = Math.max(0, Math.floor(Number(value) || 0));
    this.blockQuotas.update((current) => ({ ...current, [blockId]: safe }));
  }

  protected applyAvailableQuotas(): void {
    const counts = this.store.questionCountByBlock();
    const next: Record<StudyBlockId, number> = {};
    for (const block of this.store.blocks()) {
      next[block.id] = counts[block.id] ?? 0;
    }
    this.blockQuotas.set(next);
  }

  protected applyBalancedQuotas(): void {
    const blocks = this.store.blocks();
    const counts = this.store.questionCountByBlock();
    const populated = blocks.filter((b) => (counts[b.id] ?? 0) > 0);
    const next: Record<StudyBlockId, number> = {};

    if (populated.length === 0) {
      for (const block of blocks) {
        next[block.id] = 0;
      }
      this.blockQuotas.set(next);
      return;
    }

    const totalAvailable = populated.reduce((sum, b) => sum + (counts[b.id] ?? 0), 0);
    const targetTotal = Math.min(totalAvailable, Math.max(20, populated.length * 10));
    const perBlock = Math.max(1, Math.floor(targetTotal / populated.length));

    for (const block of blocks) {
      const avail = counts[block.id] ?? 0;
      next[block.id] = avail > 0 ? Math.min(avail, perBlock) : 0;
    }
    this.blockQuotas.set(next);
  }

  protected startTest(): void {
    const mode = this.selectedMode();
    const block = this.selectedBlock();
    const blockIds = block === 'ALL' ? undefined : [block];
    const topicId = this.selectedTopicId() === 'ALL' ? undefined : this.selectedTopicId();

    const generated = generateTestQuestions(this.store.questions(), {
      mode,
      blockIds,
      topicId,
      caseStudyId: this.selectedCaseStudyId() || undefined,
      questionCount: this.questionCount(),
      blockQuotas: mode === 'simulation' ? this.blockQuotas() : undefined,
      mistakesFilter: this.mistakesFilter(),
      onlyUnanswered: this.onlyUnanswered(),
      shuffle: this.shuffle(),
    });

    if (generated.questions.length === 0) {
      this.snackBar.open('No hay preguntas disponibles para esta configuración.', 'Cerrar', {
        duration: 3500,
      });
      return;
    }

    const caseStudy =
      mode === 'case_study' && this.selectedCaseStudyId()
        ? this.store.getCaseStudyById(this.selectedCaseStudyId())
        : undefined;

    const title = this.buildSessionTitle(mode, generated.questions.length, caseStudy?.title);
    const immediateFeedback =
      mode === 'practice' ||
      mode === 'mistakes' ||
      (mode === 'case_study' && this.caseStudyImmediateFeedback());

    const timeLimitSec =
      mode === 'simulation' && this.timeLimitMinutes() > 0
        ? this.timeLimitMinutes() * 60
        : null;

    this.runner.startSession(generated.questions, {
      title,
      mode,
      penaltyRatio: mode === 'practice' ? 0 : this.penaltyRatio(),
      immediateFeedback,
      timeLimitSec,
      caseStudy,
    });

    void this.router.navigate(['/tests/session']);
  }

  private buildSessionTitle(
    mode: ExamMode,
    count: number,
    caseStudyTitle?: string,
  ): string {
    if (mode === 'case_study' && caseStudyTitle) {
      return `Supuesto: ${caseStudyTitle}`;
    }
    if (mode === 'simulation') {
      return `Simulacro (${count} preg.)`;
    }
    if (mode === 'mistakes') {
      return `Repaso de fallos y marcadas (${count} preg.)`;
    }
    const topicId = this.selectedTopicId();
    if (topicId !== 'ALL') {
      const topic = this.store.getTopicById(topicId);
      if (topic) return `Práctica: ${topic.title}`;
    }
    const block = this.selectedBlock();
    if (block !== 'ALL') {
      const b = this.store.getBlockById(block);
      if (b) return `Práctica ${b.code} (${count} preg.)`;
    }
    return `Práctica general (${count} preg.)`;
  }
}
