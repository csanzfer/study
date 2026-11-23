import { Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { CaseStudy, ExamMode, TaiBlockId } from '../../../core/models/study.models';
import { StudyStoreService } from '../../../core/services/study-store.service';
import { CaseStudiesPanel } from '../case-studies-panel/case-studies-panel';
import { QuestionBank } from '../question-bank/question-bank';
import { TestRunnerService } from '../services/test-runner.service';
import { TestAnalytics } from '../test-analytics/test-analytics';
import { TestLauncher } from '../test-launcher/test-launcher';
import { TopicPerformance } from '../utils/test-analytics.util';

export type TestsTab = 'launcher' | 'bank' | 'cases' | 'analytics';

const VALID_TABS = new Set<TestsTab>(['launcher', 'bank', 'cases', 'analytics']);
const VALID_MODES = new Set<ExamMode>(['practice', 'simulation', 'mistakes', 'case_study']);
const VALID_BLOCKS = new Set<TaiBlockId>(['B1', 'B2', 'B3', 'B4']);

interface TestsTabMeta {
  id: TestsTab;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-tests-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    TestLauncher,
    QuestionBank,
    CaseStudiesPanel,
    TestAnalytics,
  ],
  templateUrl: './tests-page.html',
})
export class TestsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly store = inject(StudyStoreService);
  protected readonly runner = inject(TestRunnerService);

  protected readonly tabs: TestsTabMeta[] = [
    { id: 'launcher', label: 'Lanzar test', icon: 'play_circle' },
    { id: 'bank', label: 'Banco de preguntas', icon: 'library_books' },
    { id: 'cases', label: 'Supuestos prácticos', icon: 'article' },
    { id: 'analytics', label: 'Analítica y evolución', icon: 'insights' },
  ];

  private readonly queryParams = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => ({
        tab: params.get('tab'),
        mode: params.get('mode'),
        blockId: params.get('blockId'),
        topicId: params.get('topicId'),
      })),
    ),
    { initialValue: { tab: null, mode: null, blockId: null, topicId: null } },
  );

  protected readonly activeTab = signal<TestsTab>('launcher');
  protected readonly launcherMode = signal<ExamMode | null>(null);
  protected readonly launcherBlockId = signal<TaiBlockId | null>(null);
  protected readonly launcherTopicId = signal<string | null>(null);

  constructor() {
    effect(() => {
      const q = this.queryParams();
      if (q.tab && VALID_TABS.has(q.tab as TestsTab)) {
        this.activeTab.set(q.tab as TestsTab);
      }
      if (q.mode && VALID_MODES.has(q.mode as ExamMode)) {
        this.launcherMode.set(q.mode as ExamMode);
      }
      if (q.blockId && VALID_BLOCKS.has(q.blockId as TaiBlockId)) {
        this.launcherBlockId.set(q.blockId as TaiBlockId);
      }
      if (q.topicId) {
        this.launcherTopicId.set(q.topicId);
      }
    });
  }

  protected selectTab(tab: TestsTab): void {
    this.activeTab.set(tab);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected onLaunchCaseStudy(cs: CaseStudy): void {
    const questions = this.store.getQuestionsForCaseStudy(cs.id);
    if (questions.length === 0) return;

    this.runner.startSession(questions, {
      title: `Supuesto: ${cs.title}`,
      mode: 'case_study',
      penaltyRatio: 1 / 3,
      immediateFeedback: false,
      timeLimitSec: null,
      caseStudy: cs,
    });
    void this.router.navigate(['/tests/session']);
  }

  protected onPracticeWeakTopic(topicPerf: TopicPerformance): void {
    this.launcherMode.set('practice');
    this.launcherBlockId.set(topicPerf.blockId);
    this.launcherTopicId.set(topicPerf.topicId);
    this.selectTab('launcher');
  }

  protected onLaunchMistakesFromAnalytics(): void {
    this.launcherMode.set('mistakes');
    this.launcherBlockId.set(null);
    this.launcherTopicId.set(null);
    this.selectTab('launcher');
  }
}
