import { Injectable, computed, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  DEFAULT_POMODORO_SETTINGS,
  PomodoroSettings,
  StudySession,
  StudySessionType,
} from '../models/study.models';
import { StudyStoreService } from './study-store.service';

export type PomodoroPhase = 'focus' | 'short_break' | 'long_break';
export type PomodoroStatus = 'idle' | 'running' | 'paused';

const SETTINGS_STORAGE_KEY = 'tai-study:pomodoro-settings';

@Injectable({ providedIn: 'root' })
export class PomodoroService {
  private readonly store = inject(StudyStoreService);
  private readonly snackBar = inject(MatSnackBar);

  readonly settings = signal<PomodoroSettings>(this.loadSettings());
  readonly phase = signal<PomodoroPhase>('focus');
  readonly status = signal<PomodoroStatus>('idle');
  readonly remainingSeconds = signal<number>(this.settings().focusMinutes * 60);
  readonly selectedTopicId = signal<string | null>(null);
  readonly sessionType = signal<StudySessionType>('reading');
  readonly completedFocusCycles = signal<number>(0);

  readonly isActive = computed(() => this.status() !== 'idle');

  readonly selectedTopic = computed(() => {
    const id = this.selectedTopicId();
    return id ? this.store.getTopicById(id) : undefined;
  });

  readonly totalPhaseSeconds = computed(() => this.getDurationForPhase(this.phase()) * 60);

  readonly progressPercent = computed(() => {
    const total = this.totalPhaseSeconds();
    if (total <= 0) {
      return 0;
    }
    const elapsed = total - this.remainingSeconds();
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  });

  readonly formattedTime = computed(() => {
    const secs = Math.max(0, this.remainingSeconds());
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  });

  readonly phaseLabel = computed(() => {
    switch (this.phase()) {
      case 'focus':
        return 'Enfoque';
      case 'short_break':
        return 'Descanso corto';
      case 'long_break':
        return 'Descanso largo';
    }
  });

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private targetEndMs: number | null = null;
  private phaseStartedAtIso: string | null = null;
  private elapsedSecondsBeforePause = 0;

  selectTopic(topicId: string | null): void {
    this.selectedTopicId.set(topicId);
  }

  setSessionType(type: StudySessionType): void {
    this.sessionType.set(type);
  }

  updateSettings(patch: Partial<PomodoroSettings>): void {
    const current = this.settings();
    const next: PomodoroSettings = {
      focusMinutes: this.clampMinutes(patch.focusMinutes ?? current.focusMinutes, 1, 120),
      shortBreakMinutes: this.clampMinutes(
        patch.shortBreakMinutes ?? current.shortBreakMinutes,
        1,
        60,
      ),
      longBreakMinutes: this.clampMinutes(
        patch.longBreakMinutes ?? current.longBreakMinutes,
        1,
        90,
      ),
      cyclesBeforeLongBreak: this.clampMinutes(
        patch.cyclesBeforeLongBreak ?? current.cyclesBeforeLongBreak,
        1,
        12,
      ),
      soundEnabled: patch.soundEnabled ?? current.soundEnabled,
    };

    this.settings.set(next);
    this.persistSettings(next);

    if (this.status() === 'idle') {
      this.remainingSeconds.set(this.getDurationForPhase(this.phase()) * 60);
    }
  }

  setPhase(nextPhase: PomodoroPhase): void {
    this.clearInterval();
    this.phase.set(nextPhase);
    this.status.set('idle');
    this.remainingSeconds.set(this.getDurationForPhase(nextPhase) * 60);
    this.targetEndMs = null;
    this.phaseStartedAtIso = null;
    this.elapsedSecondsBeforePause = 0;
  }

  start(topicId?: string): void {
    if (topicId !== undefined) {
      this.selectedTopicId.set(topicId);
    }

    if (this.status() === 'running') {
      return;
    }

    if (this.status() === 'idle') {
      this.phaseStartedAtIso = new Date().toISOString();
      this.elapsedSecondsBeforePause = 0;
      this.remainingSeconds.set(this.getDurationForPhase(this.phase()) * 60);
    }

    this.targetEndMs = Date.now() + this.remainingSeconds() * 1000;
    this.status.set('running');
    this.startTicking();
  }

  pause(): void {
    if (this.status() !== 'running') {
      return;
    }

    this.syncRemainingFromClock();
    const total = this.totalPhaseSeconds();
    this.elapsedSecondsBeforePause = Math.max(0, total - this.remainingSeconds());
    this.clearInterval();
    this.targetEndMs = null;
    this.status.set('paused');
  }

  togglePlayPause(): void {
    if (this.status() === 'running') {
      this.pause();
    } else {
      this.start();
    }
  }

  reset(): void {
    this.clearInterval();
    this.status.set('idle');
    this.remainingSeconds.set(this.getDurationForPhase(this.phase()) * 60);
    this.targetEndMs = null;
    this.phaseStartedAtIso = null;
    this.elapsedSecondsBeforePause = 0;
  }

  async finishAndLogEarly(): Promise<StudySession | null> {
    if (this.phase() !== 'focus' || this.status() === 'idle') {
      return null;
    }

    if (this.status() === 'running') {
      this.syncRemainingFromClock();
    }

    const totalSeconds = this.totalPhaseSeconds();
    const elapsedSeconds = Math.max(
      this.elapsedSecondsBeforePause,
      totalSeconds - this.remainingSeconds(),
    );
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);

    if (elapsedMinutes < 1) {
      this.snackBar.open(
        'Completa al menos 1 minuto de enfoque para registrar la sesión.',
        'Cerrar',
        { duration: 3000 },
      );
      return null;
    }

    this.clearInterval();
    this.targetEndMs = null;
    this.status.set('idle');
    const session = await this.recordFocusSession(elapsedMinutes);
    if (!session) {
      this.snackBar.open(
        `Enfoque finalizado (${elapsedMinutes} min). Selecciona un tema para guardar métricas.`,
        'Cerrar',
        { duration: 3500 },
      );
    }
    this.advanceToNextPhaseAfterFocus();
    return session;
  }

  skipPhase(): void {
    this.clearInterval();
    this.targetEndMs = null;
    this.phaseStartedAtIso = null;
    this.elapsedSecondsBeforePause = 0;

    if (this.phase() === 'focus') {
      this.setPhase('short_break');
    } else {
      this.setPhase('focus');
    }
  }

  private startTicking(): void {
    this.clearInterval();
    this.intervalId = setInterval(() => {
      this.tick();
    }, 250);
  }

  private tick(): void {
    if (this.status() !== 'running' || this.targetEndMs === null) {
      return;
    }

    const remaining = Math.ceil((this.targetEndMs - Date.now()) / 1000);
    if (remaining <= 0) {
      this.remainingSeconds.set(0);
      void this.handlePhaseComplete();
    } else if (remaining !== this.remainingSeconds()) {
      this.remainingSeconds.set(remaining);
    }
  }

  private syncRemainingFromClock(): void {
    if (this.targetEndMs !== null) {
      const remaining = Math.max(0, Math.ceil((this.targetEndMs - Date.now()) / 1000));
      this.remainingSeconds.set(remaining);
    }
  }

  private async handlePhaseComplete(): Promise<void> {
    this.clearInterval();
    this.targetEndMs = null;

    if (this.settings().soundEnabled) {
      this.playCompletionTone();
    }

    if (this.phase() === 'focus') {
      const durationMinutes = this.settings().focusMinutes;
      const saved = await this.recordFocusSession(durationMinutes);
      this.completedFocusCycles.update((c) => c + 1);

      const message = saved
        ? `Pomodoro completado (+${durationMinutes} min registrados). ¡Toca descanso!`
        : `Pomodoro de ${durationMinutes} min completado. Selecciona un tema para guardar métricas.`;
      this.snackBar.open(message, 'Cerrar', { duration: 4500 });

      this.advanceToNextPhaseAfterFocus();
    } else {
      this.snackBar.open('Descanso finalizado. Listo para el siguiente bloque de enfoque.', 'Cerrar', {
        duration: 4000,
      });
      this.setPhase('focus');
    }
  }

  private advanceToNextPhaseAfterFocus(): void {
    const cycles = this.completedFocusCycles();
    const isLong = cycles > 0 && cycles % this.settings().cyclesBeforeLongBreak === 0;
    this.setPhase(isLong ? 'long_break' : 'short_break');
  }

  private async recordFocusSession(durationMinutes: number): Promise<StudySession | null> {
    const topic = this.selectedTopic();
    if (!topic) {
      return null;
    }

    return this.store.addStudySession({
      topicId: topic.id,
      blockId: topic.blockId,
      startedAt: this.phaseStartedAtIso ?? undefined,
      endedAt: new Date().toISOString(),
      durationMinutes,
      type: this.sessionType(),
    });
  }

  private getDurationForPhase(phase: PomodoroPhase): number {
    const cfg = this.settings();
    switch (phase) {
      case 'focus':
        return cfg.focusMinutes;
      case 'short_break':
        return cfg.shortBreakMinutes;
      case 'long_break':
        return cfg.longBreakMinutes;
    }
  }

  private clearInterval(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private clampMinutes(value: number, min: number, max: number): number {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return min;
    }
    return Math.min(max, Math.max(min, Math.round(num)));
  }

  private loadSettings(): PomodoroSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) {
        return { ...DEFAULT_POMODORO_SETTINGS };
      }
      const parsed = JSON.parse(raw) as Partial<PomodoroSettings>;
      return {
        focusMinutes: this.clampMinutes(
          parsed.focusMinutes ?? DEFAULT_POMODORO_SETTINGS.focusMinutes,
          1,
          120,
        ),
        shortBreakMinutes: this.clampMinutes(
          parsed.shortBreakMinutes ?? DEFAULT_POMODORO_SETTINGS.shortBreakMinutes,
          1,
          60,
        ),
        longBreakMinutes: this.clampMinutes(
          parsed.longBreakMinutes ?? DEFAULT_POMODORO_SETTINGS.longBreakMinutes,
          1,
          90,
        ),
        cyclesBeforeLongBreak: this.clampMinutes(
          parsed.cyclesBeforeLongBreak ?? DEFAULT_POMODORO_SETTINGS.cyclesBeforeLongBreak,
          1,
          12,
        ),
        soundEnabled: parsed.soundEnabled ?? DEFAULT_POMODORO_SETTINGS.soundEnabled,
      };
    } catch {
      return { ...DEFAULT_POMODORO_SETTINGS };
    }
  }

  private persistSettings(settings: PomodoroSettings): void {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage errors
    }
  }

  private playCompletionTone(): void {
    try {
      const AudioCtx =
        typeof window !== 'undefined'
          ? window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
          : undefined;
      if (!AudioCtx) {
        return;
      }

      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const freqs = [523.25, 659.25, 783.99]; // C5 - E5 - G5 soft chime

      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.14);
        gain.gain.setValueAtTime(0.001, now + idx * 0.14);
        gain.gain.exponentialRampToValueAtTime(0.12, now + idx * 0.14 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.14);
        osc.stop(now + idx * 0.14 + 0.36);
      });

      setTimeout(() => {
        void ctx.close();
      }, 1000);
    } catch {
      // Ignore Web Audio API failures in restricted environments
    }
  }
}
