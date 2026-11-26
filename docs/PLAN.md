# Plan de Análisis y Desarrollo — App de Estudio

> **Objetivo:** Aplicación web **local-first** para estudiar, optimizada para pasar apuntes desde libros físicos/Word, generar esquemas automáticos, planificar vueltas al temario, practicar tests oficiales y retener conceptos clave.

---

## 1. Principios de Diseño

1. **Estudiar primero, programar después:** cada fase entrega valor usable desde el primer momento (MVP centrado en Apuntes + Esquemas).
2. **Local-First real:** 100% funcional en el navegador sin necesidad de backend ni conexión a internet (PWA), con copias de seguridad portables (`.json`).
3. **Cero doble trabajo:** los apuntes escritos o importados desde Word generan automáticamente los mapas mentales y permiten crear flashcards directamente desde el texto seleccionado.
4. **Preparada para crecer:** acceso a datos desacoplado tras interfaces de repositorio para poder añadir sincronización en la nube en el futuro sin reescribir la UI.

---

## 2. Stack Tecnológico Acordado

| Capa | Tecnología | Motivo |
| :--- | :--- | :--- |
| **Framework** | **Angular 19+** (Standalone, Signals, `@if`/`@for`) | Dominio previo, productividad alta y gran soporte para apps con múltiples vistas complejas. |
| **UI & Estilos** | **Tailwind CSS + Angular Material + Angular CDK** | Desarrollo rápido, componentes accesibles, tema claro/oscuro y `drag-drop` nativo para tableros. |
| **Editor de apuntes** | **TipTap** (basado en ProseMirror) | Editor enriquecido tipo Notion/Word con atajos Markdown, tablas, bloques de código y avisos personalizados (*Ojo examen*). |
| **Importación Word** | **mammoth.js** | Convierte archivos `.docx` a HTML semántico limpio directamente en el navegador (100% local). |
| **Esquemas / Mapas** | **Markmap** (`markmap-lib` + `markmap-view`) | Genera mapas mentales interactivos automáticamente a partir de los encabezados y listas de los apuntes. |
| **Persistencia local** | **IndexedDB** con **Dexie.js** | Sin límite práctico de almacenamiento (frente a los 5 MB de `localStorage`), consultas indexadas y soporte para adjuntos/backups. |
| **Búsqueda global** | **MiniSearch** | Búsqueda instantánea *full-text* en cliente sobre títulos, etiquetas y contenido de apuntes. |
| **Modo Offline** | **@angular/pwa** | Instalable como app de escritorio/tablet y usable sin conexión. |

---

## 3. Arquitectura Propuesta

### 3.1. Flujo de contenido (Libros físicos → Estudio activo)

```text
Libro físico ──► Word (.docx) ──[mammoth.js]──► Editor TipTap (o redacción directa)
                                                       │
                          ┌────────────────────────────┼────────────────────────────┐
                          ▼                            ▼                            ▼
                Guardado automático         Extractor de estructura      "Crear flashcard"
                en IndexedDB (Dexie)        (H1-H4 + listas → MD)        desde texto marcado
                          │                            │                            │
                          ▼                            ▼                            ▼
                 Backup .json local          Mapa Mental (Markmap)        Repaso SRS (Fase 4)
```

### 3.2. Estructura de carpetas (Feature-based)

```text
src/app/
├── core/
│   ├── db/                    # Esquema Dexie.js, migraciones y seed de Bloques TAI
│   ├── repositories/          # Interfaces + implementación IndexedDB (fácil migración a cloud)
│   ├── services/              # BackupService, SearchService, ThemeService
│   └── models/                # Modelos de dominio (Block, Topic, Question, Flashcard...)
├── shared/
│   ├── components/            # Layout, sidebar, buscador global, confirm dialogs
│   └── utils/                 # Conversor TipTap JSON -> Markdown para Markmap, helpers SRS
└── features/
    ├── dashboard/             # Resumen rápido, misiones diarias y estado de los 4 bloques
    ├── notes/                 # Lista de bloques/temas, editor TipTap e importador .docx
    ├── schemas/               # Visor interactivo Markmap (desde apunte o esquema propio)
    ├── planner/               # Tablero Kanban de vueltas, heatmap y Pomodoro (Fase 2)
    ├── tests/                 # Banco de preguntas, simulacros INAP y supuestos (Fase 3)
    └── flashcards/            # Repaso espaciado y gamificación (Fase 4)
```

---

## 4. Modelo de Datos Inicial (Dexie.js / IndexedDB)

```ts
export type TaiBlockId = 'B1' | 'B2' | 'B3' | 'B4';

export type TopicStatus =
  | 'pending'       // Sin empezar
  | 'first_round'   // 1ª vuelta (comprensión)
  | 'outlined'      // Esquematizado
  | 'memorizing'    // Memorización / repaso activo
  | 'mastered';     // Dominado

export interface TaiBlock {
  id: TaiBlockId;
  code: string;         // "Bloque I", "Bloque II", ...
  title: string;        // Organización del Estado, Tecnología Básica, Desarrollo, Sistemas
  color: string;
  order: number;
}

export interface Topic {
  id: string;
  blockId: TaiBlockId;
  order: number;
  title: string;
  status: TopicStatus;
  roundCount: number;           // Nº de vueltas completas
  tags: string[];               // ej: ['leyes', 'plazos', 'muy-preguntado']
  contentJson: unknown;         // Documento TipTap en JSON (fuente de verdad)
  plainText: string;            // Texto plano indexable para búsqueda rápida
  customOutlineMd?: string;     // Opcional: esquema manual resumido si difiere del apunte
  createdAt: string;
  updatedAt: string;
  lastReviewedAt?: string;
}

// --- Fases posteriores ---

export interface StudySession {
  id: string;
  topicId: string;
  blockId: TaiBlockId;
  startedAt: string;
  durationMinutes: number;
  type: 'reading' | 'schema' | 'test' | 'flashcards';
}

export interface Question {
  id: string;
  blockId: TaiBlockId;
  topicId?: string;
  caseStudyId?: string;         // Para supuestos prácticos (Bloque III / IV)
  prompt: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation?: string;
  reference?: string;           // ej: "Art. 21 Ley 39/2015"
  flagged: boolean;
  stats: {
    attempts: number;
    correct: number;
    lastAnsweredAt?: string;
  };
}

export interface ExamAttempt {
  id: string;
  date: string;
  mode: 'practice' | 'simulation' | 'mistakes' | 'case_study';
  penaltyRatio: number;         // ej: 0.3333 (-1/3) o 0
  answers: Array<{
    questionId: string;
    selectedIndex: number | null; // null = en blanco
    isCorrect: boolean;
  }>;
  netScore: number;
  maxScore: number;
  durationSec: number;
}

export interface Flashcard {
  id: string;
  blockId: TaiBlockId;
  topicId: string;
  front: string;
  back: string;
  tags: string[];
  srs: {
    intervalDays: number;
    easeFactor: number;         // SM-2 inicial: 2.5
    repetitions: number;
    dueDate: string;            // ISO date
  };
}

export interface GamificationProfile {
  id: 'local-user';
  xp: number;
  streakDays: number;
  streakFreezes: number;        // Días de descanso permitidos sin romper racha
  lastActiveDate?: string;
  weeklyRestDays: number[];     // ej: [0] para domingos
}
```

---

## 5. Plan de Desarrollo por Fases

### Fase 0 — Setup y Base Arquitectónica ✅
**Objetivo:** Tener el proyecto Angular funcionando en local con estilos, navegación base, base de datos local y backup seguro.

- [x] Inicializar proyecto Angular (Standalone + Routing + SCSS/Tailwind).
- [x] Configurar **Tailwind CSS** + **Angular Material** (incluyendo soporte de modo claro/oscuro).
- [x] Configurar **Dexie.js** con la tabla inicial de `blocks` y `topics`, precargando los **4 Bloques oficiales de TAI**:
  - **Bloque I:** Organización del Estado y Administración Electrónica
  - **Bloque II:** Tecnología Básica
  - **Bloque III:** Desarrollo de Sistemas
  - **Bloque IV:** Sistemas y Comunicaciones
- [x] Crear layout principal responsive (sidebar con los 4 bloques, barra superior con buscador y botón de backup).
- [x] Implementar **Exportar / Importar Backup completo (`.json`)** para proteger los datos desde el primer día.
- [x] Configurar `@angular/pwa` para instalación local y uso offline.

**Criterio de hecho:** La app arranca en local, persiste datos en IndexedDB tras recargar y permite exportar/restaurar un archivo `.json`.

---

### Fase 1 (MVP) — Apuntes, Importador `.docx` y Esquemas Automáticos ✅
**Objetivo:** Poder empezar a estudiar y construir tu temario TAI desde el primer momento.

#### 1A. Gestión de Temas y Editor TipTap
- [x] CRUD completo de temas dentro de cada bloque (crear, renombrar, reordenar, etiquetar, eliminar).
- [x] Integrar **TipTap** en un componente reutilizable de Angular con:
  - Encabezados (`H1`–`H4`), negrita/cursiva/subrayado, listas anidadas y checklists.
  - Tablas (muy útiles para comparativas de leyes, OSI/TCP, SQL) y bloques de código.
  - Bloque destacado personalizado: **Callout "Ojo examen"** (para plazos, excepciones y trampas típicas).
  - Atajos tipo Markdown (`# `, `- `, `**texto**`, `` `código` ``).
  - **Autoguardado** con debounce (ej. 800 ms) + indicador visual *"Guardado"*.
- [x] Integrar **importación de Word (`.docx`) con `mammoth.js`**:
  - Subir archivo `.docx` mediante selector o drag & drop.
  - Opción de crear un tema nuevo a partir del `.docx` o insertar el contenido en un tema existente.
  - Limpieza automática de estilos basura de Word conservando la jerarquía semántica.
- [x] Implementar búsqueda global instantánea (**MiniSearch**) por título, etiquetas y contenido.

#### 1B. Esquemas Automáticos (Markmap)
- [x] Crear conversor `tiptapJsonToOutlineMarkdown()` que extraiga automáticamente encabezados (`H1`–`H4`) y listas del apunte.
- [x] Integrar **Markmap** en una vista de esquema asociada a cada tema (pestaña *"Apunte"* / *"Esquema"* o vista dividida en pantallas grandes).
- [x] Controles del mapa mental:
  - Zoom, centrado automático y modo pantalla completa.
  - Selector de profundidad (ej. *"Solo títulos"*, *"Hasta H3"*, *"Completo con viñetas"*).
  - Plegar/desplegar ramas para practicar memoria activa (ocultar subramas e intentar recordarlas).
  - Exportación del esquema a **SVG/PNG** (o vista imprimible).
- [x] Opción de activar un *"Esquema resumido propio"* por tema si en algún tema prefieres una versión más condensada que el apunte completo.

**Criterio de hecho:** Puedes subir un `.docx` de un tema de tus libros, editarlo cómodamente en TipTap, buscar cualquier concepto y visualizar/estudiar su mapa mental automático al instante.

---

### Fase 2 — Tableros de Estudio y Planificación ✅
**Objetivo:** Controlar el avance real del temario, las vueltas y el tiempo dedicado a cada bloque.

- [x] **Tablero Kanban de vueltas** (`@angular/cdk/drag-drop`): columnas `Sin empezar`, `1ª Vuelta`, `Esquematizado`, `Memorizando`, `Dominado` filtrable por bloque.
- [x] Registro automático de `lastReviewedAt` e incremento de `roundCount` al completar una vuelta.
- [x] **Mapa de salud del temario (Heatmap):** vista compacta de los 4 bloques con código de color según días sin repasar (detecta temas "oxidados").
- [x] **Planificador semanal ligero:** asignar temas objetivo a cada día de la semana.
- [x] **Temporizador Pomodoro integrado:** vincula cada sesión (25/5 o configurable) a un tema y guarda métricas de horas reales por bloque.

**Criterio de hecho:** Ves de un vistazo en qué estado está cada bloque, qué temas llevan más tiempo sin repasarse y cuántas horas reales dedicas a la semana.

---

### Fase 3 — Motor de Tests y Simulacros TAI ✅
**Objetivo:** Practicar preguntas tipo examen oficial con penalización real y seguimiento de fallos.

- [x] **Gestor de banco de preguntas:** creación manual + importador rápido (CSV / JSON / texto formateado para pegar tandas de preguntas de exámenes INAP o libros).
- [x] **Generador automático de preguntas desde apuntes:** extracción 100% offline desde tablas, definiciones, listas y bloques *"Ojo examen"* del tema + generador de prompt calibrado estilo INAP listo para copiar en cualquier IA y pegar/importar el resultado.
- [x] **Modos de test:**
  - *Práctica por tema o bloque:* corrección inmediata mostrando explicación y referencia.
  - *Simulacro oficial TAI:* cronómetro, distribución configurable por bloques, opción en blanco y penalización configurable (`-1/3` por defecto).
  - *Repaso inteligente de fallos y marcadas:* genera un test solo con preguntas falladas anteriormente o marcadas con bandera.
  - *Supuestos prácticos:* vista dividida con enunciado común fijo y batería de preguntas asociadas.
- [x] **Panel de analítica de tests:** evolución de nota neta, porcentaje de acierto por bloque/tema y listado de temas más débiles.

**Criterio de hecho:** Puedes hacer tests por tema o simulacros completos con nota neta real e identificar automáticamente tus puntos débiles.

---

### Fase 4 — Flashcards (Repetición Espaciada) y Planificación Gamificada ✅
**Objetivo:** Consolidar memoria a largo plazo (leyes, plazos, puertos, siglas) y hacer más llevadera la constancia diaria.

#### 4A. Flashcards con Repetición Espaciada (SRS)
- [x] Implementar algoritmo **SM-2** (botones: *Otra vez*, *Difícil*, *Bien*, *Fácil*) para programar automáticamente la próxima fecha de repaso.
- [x] Integración directa con el editor TipTap: seleccionar texto en un apunte → botón **"Crear flashcard"** vinculada al tema.
- [x] Cola diaria de repaso filtrable por bloque o etiqueta (`plazos`, `puertos`, `siglas`, `comandos`) con soporte específico para **revisión de siglas TAI** (pack base B1–B4, extracción automática y modo bidireccional).

#### 4B. Planificación Gamificada
- [x] **Mapa de campaña / niveles por Bloque:** cada tema suma progreso/nivel al avanzar de vuelta, tener esquema, dominar flashcards y superar el 75% en tests.
- [x] **Misiones diarias autogeneradas:** sugerencias realistas según tu planificación, flashcards pendientes y temas oxidados (ej.: *"Repasa 15 flashcards de Bloque I + completa 1 Pomodoro del Tema 4"*).
- [x] **Racha flexible:** contador de constancia respetando días de descanso configurados y con "congeladores" para no generar frustración si un día no puedes estudiar.

**Criterio de hecho:** Cada día la app te propone un plan claro y alcanzable (misiones + flashcards vencidas) y refleja visualmente tu avance en los 4 bloques TAI.

---

### Fase 5 (Opcional / Futuro) — Evolución y Extras
- [x] Sincronización multidispositivo (Supabase o Firebase) implementando un nuevo `CloudStudyRepository`.
- [x] Exportación de apuntes a Markdown/PDF para impresión.
- [x] Asistente de importación desde PDFs de convocatorias oficiales del INAP.

---

## 6. Riesgos Técnicos y Buenas Prácticas a Tener en Cuenta

1. **Seguridad de los datos locales:** IndexedDB se borra si limpias por completo los datos del sitio en el navegador. Solución: aviso discreto en el dashboard si llevan más de 7 días sin descargar un backup `.json` (y solicitar `navigator.storage.persist()`).
2. **Calidad de la importación de Word (`.docx`):** si un Word usa negritas grandes en vez de estilos `Título 1`/`Título 2`, `mammoth.js` los importará como párrafos `<p><strong>`. Solución: en TipTap será muy rápido convertir líneas a `H1`–`H3` con atajos (`Ctrl/Cmd + Alt + 1..3`) para que Markmap los detecte al instante.
3. **Rendimiento de búsqueda:** guardar un campo `plainText` actualizado al guardar cada tema evita parsear todos los documentos TipTap JSON al buscar.
4. **Control de alcance:** terminar y empezar a usar la **Fase 1** antes de abrir tareas de Fase 2+.
