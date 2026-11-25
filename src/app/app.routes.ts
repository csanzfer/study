import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'blocks/:blockId',
    loadComponent: () =>
      import('./features/block-view/block-view').then((m) => m.BlockView),
  },
  {
    path: 'blocks/:blockId/topics/:topicId',
    loadComponent: () =>
      import('./features/notes/topic-detail/topic-detail').then((m) => m.TopicDetail),
    canDeactivate: [
      async (component: unknown) => {
        const { topicDetailCanDeactivateGuard } = await import(
          './features/notes/topic-detail/topic-detail'
        );
        return (topicDetailCanDeactivateGuard as (c: unknown) => Promise<boolean>)(component);
      },
    ],
  },
  {
    path: 'schemas',
    loadComponent: () =>
      import('./features/schemas/schemas-index/schemas-index').then((m) => m.SchemasIndex),
  },
  {
    path: 'planner',
    loadComponent: () =>
      import('./features/planner/planner-page/planner-page').then((m) => m.PlannerPage),
  },
  {
    path: 'tests',
    loadComponent: () =>
      import('./features/tests/tests-page/tests-page').then((m) => m.TestsPage),
  },
  {
    path: 'tests/session',
    loadComponent: () =>
      import('./features/tests/test-runner/test-runner').then((m) => m.TestRunner),
    canDeactivate: [
      async (component: unknown) => {
        const { testRunnerCanDeactivateGuard } = await import(
          './features/tests/test-runner/test-runner'
        );
        return (testRunnerCanDeactivateGuard as (c: unknown) => Promise<boolean>)(component);
      },
    ],
  },
  {
    path: 'flashcards',
    loadComponent: () =>
      import('./features/flashcards/flashcards-page/flashcards-page').then(
        (m) => m.FlashcardsPage,
      ),
  },
  {
    path: 'guide',
    loadComponent: () =>
      import('./features/guide/guide-page').then((m) => m.GuidePage),
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
