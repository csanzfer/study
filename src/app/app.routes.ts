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
  },
  {
    path: 'schemas',
    loadComponent: () =>
      import('./features/coming-soon/coming-soon').then((m) => m.ComingSoon),
    data: {
      title: 'Esquemas automáticos (Markmap)',
      phase: 'Fase 1',
      icon: 'account_tree',
      description:
        'Visualización interactiva de mapas mentales generados automáticamente desde los títulos y listas de tus apuntes.',
    },
  },
  {
    path: 'planner',
    loadComponent: () =>
      import('./features/coming-soon/coming-soon').then((m) => m.ComingSoon),
    data: {
      title: 'Tablero Kanban y Planificador',
      phase: 'Fase 2',
      icon: 'view_kanban',
      description:
        'Control de vueltas al temario, mapa de salud de temas oxidados, planificación semanal y temporizador Pomodoro.',
    },
  },
  {
    path: 'tests',
    loadComponent: () =>
      import('./features/coming-soon/coming-soon').then((m) => m.ComingSoon),
    data: {
      title: 'Motor de Tests y Simulacros TAI',
      phase: 'Fase 3',
      icon: 'quiz',
      description:
        'Banco de preguntas por bloque, simulacros oficiales con penalización (-1/3), supuestos prácticos y repaso de fallos.',
    },
  },
  {
    path: 'flashcards',
    loadComponent: () =>
      import('./features/coming-soon/coming-soon').then((m) => m.ComingSoon),
    data: {
      title: 'Flashcards SRS y Gamificación',
      phase: 'Fase 4',
      icon: 'style',
      description:
        'Repetición espaciada SM-2 para leyes, plazos y puertos, mapa de progreso por bloques y misiones diarias.',
    },
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
