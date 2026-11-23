import { Injectable, computed, inject, signal } from '@angular/core';
import {
  CaseStudy,
  ExamAttempt,
  ExamMode,
  Question,
  QuestionOptionIndex,
} from '../../../core/models/study.models';
import { StudyStoreService } from '../../../core/services/study-store.service';
import { ExamScoreResult, scoreExamAnswers } from '../utils/test-scoring.util';

export type TestSessionStatus = 'idle' | 'running' | 'finished';

export interface ActiveTestConfig {
  title: string;
  mode: ExamMode;
  penaltyRatio: number;
  immediateFeedback: boolean;
  timeLimitSec: number | null; // null = cronómetro ascendente sin límite
  caseStudy?: CaseStudy;
}

@Injectable({ providedIn: 'root' })
export class TestRunnerService {
  private readonly store = inject(StudyStoreService);

  readonly status = signal<TestSessionStatus>('idle');
  readonly config = signal<ActiveTestConfig | null>(null);
  readonly questions = signal<Question[]>([]);
  readonly currentIndex = signal(0);
  readonly selections = signal<Map<string, QuestionOptionIndex | null>>(new Map());
  readonly reviewMarks = signal<Set<string>>(new Set());
  readonly elapsedSec = signal(0);
  readonly lastAttempt = signal<ExamAttempt | null>(null);
  readonly lastScore = signal<ExamScoreResult | null>(null);

  private timerHandle: ReturnType<typeof setInterval> | null = null;

  readonly isRunning = computed(() => this.status() === 'running');
  readonly isFinished = computed(() => this.status() === 'finished');

  readonly currentQuestion = computed(() => {
    const list = this.questions();
    const idx = this.currentIndex();
    return list[idx] ?? null;
  });

  readonly answeredCount = computed(() => {
    let count = 0;
    for (const val of this.selections().values()) {
      if (val !== null) count++;
    }
    return count;
  });

  readonly blankCount = computed(() => {
    const total = this.questions().length;
    return Math.max(0, total - this.answeredCount());
  });

  readonly remainingSec = computed(() => {
    const limit = this.config()?.timeLimitSec ?? null;
    if (limit === null) return null;
    return Math.max(0, limit - this.elapsedSec());
  });

  readonly currentSelection = computed(() => {
    const q = this.currentQuestion();
    if (!q) return null;
    return this.selections().get(q.id) ?? null;
  });

  readonly isCurrentRevealed = computed(() => {
    const cfg = this.config();
    if (!cfg) return false;
    if (this.status() === 'finished') return true;
    return cfg.immediateFeedback && this.currentSelection() !== null;
  });

  startSession(questions: Question[], config: ActiveTestConfig): void {
    this.stopTimer();
    this.config.set(config);
    this.questions.set(questions);
    this.currentIndex.set(0);
    this.selections.set(new Map());
    this.reviewMarks.set(new Set());
    this.elapsedSec.set(0);
    this.lastAttempt.set(null);
    this.lastScore.set(null);
    this.status.set('running');
    this.startTimer();
  }

  selectOption(questionId: string, optionIndex: QuestionOptionIndex): void {
    if (this.status() !== 'running') {
      return;
    }
    const cfg = this.config();
    const current = this.selections().get(questionId) ?? null;

    // In immediate feedback mode (practice), lock answer once selected
    if (cfg?.immediateFeedback && current !== null) {
      return;
    }

    const next = new Map(this.selections());
    // In simulation mode, clicking the already-selected option clears it (leaves blank)
    if (!cfg?.immediateFeedback && current === optionIndex) {
      next.set(questionId, null);
    } else {
      next.set(questionId, optionIndex);
    }
    this.selections.set(next);
  }

  clearAnswer(questionId: string): void {
    if (this.status() !== 'running') {
      return;
    }
    if (this.config()?.immediateFeedback) {
      return;
    }
    const next = new Map(this.selections());
    next.set(questionId, null);
    this.selections.set(next);
  }

  toggleReviewMark(questionId: string): void {
    const next = new Set(this.reviewMarks());
    if (next.has(questionId)) {
      next.delete(questionId);
    } else {
      next.add(questionId);
    }
    this.reviewMarks.set(next);
  }

  async toggleFlagOnCurrent(): Promise<void> {
    const q = this.currentQuestion();
    if (!q) return;
    const updated = await this.store.toggleQuestionFlag(q.id);
    if (updated) {
      this.questions.update((list) =>
        list.map((item) => (item.id === updated.id ? updated : item)),
      );
    }
  }

  goToIndex(index: number): void {
    const total = this.questions().length;
    if (index >= 0 && index < total) {
      this.currentIndex.set(index);
    }
  }

  nextQuestion(): void {
    this.goToIndex(this.currentIndex() + 1);
  }

  previousQuestion(): void {
    this.goToIndex(this.currentIndex() - 1);
  }

  async finishSession(): Promise<ExamAttempt | null> {
    if (this.status() !== 'running') {
      return this.lastAttempt();
    }
    this.stopTimer();

    const cfg = this.config();
    const list = this.questions();
    if (!cfg || list.length === 0) {
      this.status.set('idle');
      return null;
    }

    const scored = scoreExamAnswers(list, this.selections(), cfg.penaltyRatio);
    this.lastScore.set(scored);
    this.status.set('finished');

    const attempt = await this.store.recordExamAttempt({
      title: cfg.title,
      mode: cfg.mode,
      penaltyRatio: cfg.penaltyRatio,
      caseStudyId: cfg.caseStudy?.id,
      answers: scored.answers,
      correctCount: scored.correctCount,
      wrongCount: scored.wrongCount,
      blankCount: scored.blankCount,
      netScore: scored.netScore,
      maxScore: scored.maxScore,
      scoreOn10: scored.scoreOn10,
      durationSec: this.elapsedSec(),
    });

    this.lastAttempt.set(attempt);
    return attempt;
  }

  reset(): void {
    this.stopTimer();
    this.status.set('idle');
    this.config.set(null);
    this.questions.set([]);
    this.currentIndex.set(0);
    this.selections.set(new Map());
    this.reviewMarks.set(new Set());
    this.elapsedSec.set(0);
    this.lastAttempt.set(null);
    this.lastScore.set(null);
  }

  private startTimer(): void {
    this.stopTimer();
    this.timerHandle = setInterval(() => {
      if (this.status() !== 'running') {
        this.stopTimer();
        return;
      }
      this.elapsedSec.update((sec) => sec + 1);
      const limit = this.config()?.timeLimitSec ?? null;
      if (limit !== null && this.elapsedSec() >= limit) {
        void this.finishSession();
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerHandle !== null) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }
}
