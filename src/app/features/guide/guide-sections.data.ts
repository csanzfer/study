import { Params } from '@angular/router';

export interface GuideItem {
  title: string;
  description: string;
}

export interface GuideAction {
  label: string;
  route: string;
  queryParams?: Params;
  icon: string;
}

export interface GuideSection {
  id: string;
  title: string;
  shortTitle: string;
  icon: string;
  badgeBgClass: string;
  badgeTextClass: string;
  summary: string;
  items: GuideItem[];
  tip?: string;
  action?: GuideAction;
  keywords: string[];
}

export interface QuickStartStep {
  number: string;
  title: string;
  description: string;
  icon: string;
}

export const QUICK_START_STEPS: QuickStartStep[] = [
  {
    number: '1',
    title: 'Crea tus asignaturas',
    description: 'Agrupa tu temario en bloques o materias y ordénalos a tu gusto.',
    icon: 'folder_special',
  },
  {
    number: '2',
    title: 'Redacta o importa apuntes',
    description: 'Escribe en el editor o importa documentos de Word (.docx) y Markdown.',
    icon: 'edit_note',
  },
  {
    number: '3',
    title: 'Estudia y repasa activamente',
    description: 'Genera esquemas automáticos, haz simulacros y repasa con flashcards SM-2.',
    icon: 'auto_awesome',
  },
];

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'local-first',
    title: 'Guardado local y copias de seguridad',
    shortTitle: 'Datos y Backup',
    icon: 'verified_user',
    badgeBgClass: 'bg-emerald-50 dark:bg-emerald-950/50',
    badgeTextClass: 'text-emerald-600 dark:text-emerald-400',
    summary:
      'Toda tu información vive en tu navegador mediante IndexedDB. No necesitas cuenta ni conexión a internet para estudiar.',
    items: [
      {
        title: '100 % offline y privado',
        description:
          'Tus apuntes, preguntas, flashcards y estadísticas nunca salen de tu dispositivo.',
      },
      {
        title: 'Exporta un backup (.json) con frecuencia',
        description:
          'Usa el botón "Backup" de la barra superior o del Panel principal para descargar un archivo .json con todo tu progreso.',
      },
      {
        title: 'Restaura en otro navegador o dispositivo',
        description:
          'Desde "Importar backup (.json)" puedes recuperar todas tus asignaturas, temas, sesiones y resultados en segundos.',
      },
    ],
    tip: 'Si borras los datos de navegación del navegador o cambias de equipo, necesitarás tu último archivo .json para no perder el trabajo.',
    action: {
      label: 'Volver al Panel principal',
      route: '/dashboard',
      icon: 'dashboard',
    },
    keywords: [
      'backup',
      'copia',
      'seguridad',
      'json',
      'exportar',
      'importar',
      'restaurar',
      'indexeddb',
      'offline',
      'local',
      'privacidad',
    ],
  },
  {
    id: 'blocks-notes',
    title: 'Asignaturas y apuntes',
    shortTitle: 'Asignaturas y Apuntes',
    icon: 'description',
    badgeBgClass: 'bg-cyan-50 dark:bg-cyan-950/50',
    badgeTextClass: 'text-cyan-600 dark:text-cyan-400',
    summary:
      'Organiza el temario en asignaturas o bloques personalizados y redacta tus apuntes en un editor pensado para estructurar el conocimiento.',
    items: [
      {
        title: 'Gestiona tus bloques',
        description:
          'Crea tantas asignaturas como necesites con código, color e icono. Puedes reordenarlas arrastrando desde el icono ⋮⋮ o editarlas desde su menú.',
      },
      {
        title: 'Editor enriquecido de temas',
        description:
          'Añade títulos (H1, H2, H3), listas, tablas, bloques de código, resaltados y etiquetas para localizar cada concepto rápido.',
      },
      {
        title: 'Importación desde Word y Markdown',
        description:
          'Dentro de cualquier tema o asignatura puedes importar apuntes que ya tengas en .docx o .md sin tener que reescribirlos.',
      },
      {
        title: 'Exportación de temas',
        description:
          'Descarga tus apuntes cuando necesites imprimirlos o compartirlos fuera de la aplicación.',
      },
    ],
    tip: 'Usa siempre títulos jerárquicos (H1, H2, H3) en tus apuntes: además de facilitar la lectura, alimentan automáticamente los esquemas mentales.',
    action: {
      label: 'Ir al Panel de asignaturas',
      route: '/dashboard',
      icon: 'school',
    },
    keywords: [
      'asignaturas',
      'bloques',
      'temas',
      'apuntes',
      'editor',
      'word',
      'docx',
      'markdown',
      'importar',
      'exportar',
      'etiquetas',
    ],
  },
  {
    id: 'schemas',
    title: 'Esquemas mentales automáticos',
    shortTitle: 'Esquemas',
    icon: 'account_tree',
    badgeBgClass: 'bg-sky-50 dark:bg-sky-950/50',
    badgeTextClass: 'text-sky-600 dark:text-sky-400',
    summary:
      'Convierte tus apuntes en mapas mentales interactivos sin duplicar trabajo: cada encabezado se transforma en una rama.',
    items: [
      {
        title: 'Sincronización automática con tus apuntes',
        description:
          'Al estructurar un tema con encabezados y listas, su esquema mental se genera al instante en la vista de Esquemas.',
      },
      {
        title: 'Plegado y enfoque visual',
        description:
          'Pliega o despliega ramas para ponerte a prueba recordando subapartados antes de revelarlos.',
      },
      {
        title: 'Exportación del mapa',
        description:
          'Puedes exportar el esquema para repasar en papel o guardarlo como imagen de referencia.',
      },
    ],
    action: {
      label: 'Abrir Esquemas',
      route: '/schemas',
      icon: 'account_tree',
    },
    keywords: [
      'esquemas',
      'mapas',
      'mentales',
      'markmap',
      'ramas',
      'encabezados',
      'titulos',
      'plegar',
      'exportar',
    ],
  },
  {
    id: 'planner',
    title: 'Planificador, vueltas y Pomodoro',
    shortTitle: 'Planificador',
    icon: 'view_kanban',
    badgeBgClass: 'bg-amber-50 dark:bg-amber-950/50',
    badgeTextClass: 'text-amber-600 dark:text-amber-400',
    summary:
      'Controla qué temas llevas al día, cuáles se están oxidando y cuánto tiempo dedicas cada semana.',
    items: [
      {
        title: 'Tablero Kanban de vueltas',
        description:
          'Mueve los temas entre columnas de estado conforme avanzas. Al completar el ciclo, se contabiliza una vuelta más.',
      },
      {
        title: 'Mapa de salud y temas oxidados',
        description:
          'Detecta de un vistazo qué temas llevan demasiados días sin repasarse para priorizarlos antes de que se olviden.',
      },
      {
        title: 'Planificador semanal',
        description:
          'Distribuye los temas y bloques que quieres abordar cada día de la semana.',
      },
      {
        title: 'Temporizador Pomodoro integrado',
        description:
          'Lanza sesiones de estudio enfocadas asociadas a un tema. Mientras esté activo, verás el contador en la barra superior para pausar o reanudar desde cualquier pantalla.',
      },
    ],
    action: {
      label: 'Ir al Planificador',
      route: '/planner',
      icon: 'view_kanban',
    },
    keywords: [
      'planificador',
      'kanban',
      'vueltas',
      'pomodoro',
      'temporizador',
      'salud',
      'oxidados',
      'semanal',
      'tiempo',
      'sesiones',
    ],
  },
  {
    id: 'tests',
    title: 'Tests, simulacros y supuestos prácticos',
    shortTitle: 'Tests y Simulacros',
    icon: 'quiz',
    badgeBgClass: 'bg-indigo-50 dark:bg-indigo-950/50',
    badgeTextClass: 'text-indigo-600 dark:text-indigo-400',
    summary:
      'Entrena en condiciones reales de examen con tu propio banco de preguntas, corrección automática y seguimiento de fallos.',
    items: [
      {
        title: 'Crea, importa o genera preguntas',
        description:
          'Añade preguntas manualmente, impórtalas en lote desde archivos/texto o PDFs de exámenes oficiales, o genera borradores a partir de tus apuntes.',
      },
      {
        title: 'Simulacros con penalización',
        description:
          'Configura tests por asignatura, tema o simulacros completos con cálculo de puntuación y penalización (-1/3 por fallo).',
      },
      {
        title: 'Modo repaso de fallos',
        description:
          'Las preguntas que fallas se registran automáticamente para que puedas lanzar sesiones específicas solo con tus puntos débiles.',
      },
      {
        title: 'Supuestos prácticos y analíticas',
        description:
          'Gestiona supuestos prácticos y consulta tu precisión media y evolución por bloque.',
      },
    ],
    tip: 'Antes de cada sesión nueva de temario, haz un test corto en modo "Repasar fallos" para consolidar los errores recientes.',
    action: {
      label: 'Abrir Tests y Simulacros',
      route: '/tests',
      icon: 'quiz',
    },
    keywords: [
      'tests',
      'simulacros',
      'preguntas',
      'banco',
      'penalizacion',
      'fallos',
      'pdf',
      'inap',
      'supuestos',
      'practicos',
      'analiticas',
    ],
  },
  {
    id: 'flashcards',
    title: 'Flashcards SM-2 y gamificación',
    shortTitle: 'Flashcards',
    icon: 'style',
    badgeBgClass: 'bg-violet-50 dark:bg-violet-950/50',
    badgeTextClass: 'text-violet-600 dark:text-violet-400',
    summary:
      'Memoriza definiciones, plazos y siglas con repetición espaciada (algoritmo SM-2) y mantén la constancia con misiones diarias.',
    items: [
      {
        title: 'Repetición espaciada SM-2',
        description:
          'Al repasar cada tarjeta valoras qué tal la recordaste; la app programa automáticamente la próxima fecha óptima de repaso.',
      },
      {
        title: 'Modo Siglas y etiquetas',
        description:
          'Etiqueta tarjetas (por ejemplo con "siglas") para lanzar sesiones rápidas focalizadas en acrónimos o conceptos concretos.',
      },
      {
        title: 'Racha flexible, misiones y campaña',
        description:
          'Completa las misiones diarias para sumar XP, subir de nivel y visualizar tu progreso global por asignaturas en el mapa de campaña.',
      },
    ],
    action: {
      label: 'Abrir Flashcards',
      route: '/flashcards',
      icon: 'style',
    },
    keywords: [
      'flashcards',
      'tarjetas',
      'sm-2',
      'repaso',
      'espaciado',
      'siglas',
      'racha',
      'misiones',
      'campana',
      'xp',
      'gamificacion',
    ],
  },
  {
    id: 'shortcuts',
    title: 'Atajos y trucos útiles',
    shortTitle: 'Atajos y Trucos',
    icon: 'bolt',
    badgeBgClass: 'bg-rose-50 dark:bg-rose-950/50',
    badgeTextClass: 'text-rose-600 dark:text-rose-400',
    summary:
      'Pequeños detalles pensados para moverte más rápido por tu espacio de estudio.',
    items: [
      {
        title: 'Búsqueda global instantánea (Ctrl + K / ⌘ + K)',
        description:
          'Pulsa el atajo desde cualquier pantalla para buscar al instante por título, contenido de apuntes o etiquetas.',
      },
      {
        title: 'Modo oscuro y claro',
        description:
          'Alterna el tema visual desde el icono del sol/luna en la barra superior para sesiones nocturnas más cómodas.',
      },
      {
        title: 'Instálala como app (PWA)',
        description:
          'Desde el menú de tu navegador puedes añadir la web a tu escritorio o pantalla de inicio para abrirla como una aplicación independiente y sin distracciones.',
      },
    ],
    keywords: [
      'atajos',
      'teclado',
      'ctrl',
      'cmd',
      'busqueda',
      'buscar',
      'oscuro',
      'claro',
      'tema',
      'pwa',
      'instalar',
    ],
  },
];
