# PLAN_CRISISSTUDENT.md — Evolución a App Genérica de Estudio (`CrisIsStudent`)

> **Objetivo:** Transformar la aplicación actual (acoplada a los 4 bloques fijos de oposiciones TAI) en **CrisIsStudent**, una aplicación web **local-first** y **PWA** de estudio genérica donde cualquier persona pueda crear, editar, ordenar y eliminar sus propios bloques o asignaturas sin ninguna dependencia del dominio TAI.
>
> **Nota:** Este documento complementa a `PLAN.md` (que se mantiene intacto como referencia histórica de las Fases 1–4) y sirve como hoja de ruta viva para avanzar fase a fase.

---

## 🎯 Decisiones Acordadas

1. **Alcance inicial (Nivel 1):** Bloques / asignaturas dinámicas e ilimitadas dentro de un único espacio de trabajo (CRUD completo + ordenación). El soporte multi-espacio / múltiples cursos queda planteado como **Nivel 2 (roadmap futuro)**.
2. **Sin plantilla TAI:** La aplicación arrancará limpia, sin sembrar bloques de TAI ni mantener el pack curado de siglas TAI como funcionalidad obligatoria.
3. **Nombre de marca:** **CrisIsStudent** (siglas/monograma sugerido para icono: `CIS` o icono académico).
4. **Compatibilidad local-first:**
   - Se conserva el nombre de la base de datos IndexedDB (`TaiStudyDB`) para no perder datos locales ya guardados en el navegador.
   - `BackupService` aceptará tanto backups antiguos (`appName: 'tai-study'`, `schemaVersion: 1..4`) como los nuevos (`appName: 'crisisstudent'`, `schemaVersion: 5`).

---

## 📊 Resumen de Progreso

- [x] **Fase 1:** Desacoplar modelo de datos, Dexie y Repositorio (CRUD de bloques)
- [x] **Fase 2:** Store reactivo dinámico y BackupService compatible
- [x] **Fase 3:** UI de gestión de bloques/asignaturas y estados vacíos
- [x] **Fase 4:** Adaptar Tests, Flashcards, Importadores y Gamificación
- [ ] **Fase 5:** Rebranding a `CrisIsStudent`, limpieza TAI, tests y verificación final

---

## Fase 1 — Modelo de Datos, Base de Datos y Repositorio

**Meta:** Eliminar el tipo rígido `'B1' | 'B2' | 'B3' | 'B4'` y dotar a la capa de persistencia de operaciones completas para bloques/asignaturas.

### Tareas

- [x] **Modelos (`src/app/core/models/study.models.ts`):**
  - Reemplazar `TaiBlockId = 'B1' | 'B2' | 'B3' | 'B4'` por `StudyBlockId = string` (y `TaiBlock` por `StudyBlock`). *(Alias `@deprecated` temporales mantenidos hasta completar Fases 2–5.)*
  - Definir `CreateBlockInput` (`code`, `title`, `shortTitle?`, `description?`, `color`, `icon`) y `UpdateBlockPatch`.
  - Definir paleta de colores e iconos Material recomendados para elegir al crear un bloque (constantes `BLOCK_COLOR_PRESETS` y `BLOCK_ICON_PRESETS`).
  - Generalizar constantes de dominio:
    - `EXAM_MODE_LABELS.simulation`: `'Simulacro de examen'` (en lugar de `'Simulacro oficial TAI'`).
    - `PENALTY_PRESETS`: `'Penalización -1/3'`, `'-1/4'`, `'-1/2'`, `'Sin penalización (0)'`.
    - Renombrar `TAI_FLASHCARD_SUGGESTED_TAGS` a `FLASHCARD_SUGGESTED_TAGS` con etiquetas genéricas (`definiciones`, `fechas`, `fórmulas`, `siglas`, `conceptos`, `vocabulario`, `ejemplos`, `resumen`).
  - Actualizar `BackupPayload` para soportar `schemaVersion: 1 | 2 | 3 | 4 | 5` y `appName: 'tai-study' | 'crisisstudent'`.
- [x] **Base de datos (`src/app/core/db/study.db.ts`):**
  - Cambiar el tipado de `blocks!: Table<StudyBlock, StudyBlockId>`.
  - Eliminar la llamada a `TAI_BLOCKS_SEED` en `ensureSeeded()` (dejar la tabla vacía en instalaciones nuevas; los usuarios existentes mantienen sus bloques actuales intactos).
  - Eliminado `src/app/core/db/tai-seed.ts` tras migrar todas sus referencias en código y tests.
- [x] **Repositorio (`src/app/core/repositories/study.repository.ts`):**
  - Añadir a `StudyRepository` e implementar en `IndexedDbStudyRepository`:
    - `saveBlock(block: StudyBlock): Promise<void>`
    - `saveBlocks(blocks: StudyBlock[]): Promise<void>`
    - `deleteBlock(id: StudyBlockId): Promise<void>`
  - Implementar `deleteBlock(id)` dentro de una **transacción Dexie** que limpie de forma consistente las entidades vinculadas al bloque (`topics`, `weeklyPlanItems`, `studySessions`, `caseStudies`, `questions`, `flashcards`) para evitar registros huérfanos.

### Criterio de aceptación de Fase 1
- El proyecto compila sin errores de tipos en `core/models`, `core/db` y `core/repositories` (tras adaptar las referencias en Fase 2).
- `deleteBlock` borra en cascada todas las entidades asociadas sin dejar referencias rotas.

---

## Fase 2 — Store Reactivo Dinámico y BackupService

**Meta:** Que `StudyStoreService` y `BackupService` operen sobre cualquier lista de bloques (0, 1 o N bloques con IDs dinámicos).

### Tareas

- [x] **Store (`src/app/core/services/study-store.service.ts`):**
  - Sustituir todos los mapas inicializados con `{ B1: 0, B2: 0, B3: 0, B4: 0 }` por `Record<string, number>` construidos dinámicamente a partir de `this.blocks()`:
    - `topicCountByBlock`
    - `studyMinutesByBlockThisWeek`
    - `studyMinutesByBlockTotal`
    - `questionCountByBlock`
    - `flashcardCountByBlock`
  - Añadir señal derivada `defaultBlockId = computed(() => this.blocks()[0]?.id ?? '')`.
  - Añadir métodos CRUD de bloques:
    - `createBlock(input: CreateBlockInput): Promise<StudyBlock>` (generando ID único tipo `block-...` y `order` incremental).
    - `updateBlock(id: StudyBlockId, patch: UpdateBlockPatch): Promise<StudyBlock | undefined>`
    - `reorderBlocks(orderedBlockIds: StudyBlockId[]): Promise<void>`
    - `deleteBlock(id: StudyBlockId): Promise<void>` (recalculando `order` de los restantes y refrescando el estado).
  - Cambiar texto por defecto de intento de examen `'Test TAI'` → `'Test de práctica'`.
- [x] **BackupService (`src/app/core/services/backup.service.ts`):**
  - Eliminar `VALID_BLOCK_IDS = new Set(['B1', 'B2', 'B3', 'B4'])` y el fallback a `TAI_BLOCKS_SEED`.
  - Validar la estructura de cada bloque en `candidate.blocks` (`isValidBlock`) y construir dinámicamente el `Set<string>` de IDs válidos a partir de los bloques presentes en el propio JSON del backup.
  - Exportar con `schemaVersion: 5`, `appName: 'crisisstudent'` y nombre de archivo `crisisstudent-backup-YYYY-MM-DD.json`.
  - En `parseBackupJson`, aceptar `appName === 'tai-study' || appName === 'crisisstudent'` y `schemaVersion` en `1..5` para mantener retrocompatibilidad total.
  - Leer `last-backup-at` manteniendo compatibilidad con la clave anterior en `localStorage` si existiera.
- [x] **Tests de Core:**
  - Actualizar mocks y tests en `study-store.service.spec.ts`, `backup.service.spec.ts`, `search.service.spec.ts`, `pomodoro.service.spec.ts` y `app.spec.ts` para usar bloques genéricos de prueba y añadir tests de `createBlock`, `updateBlock`, `reorderBlocks`, `deleteBlock` y restauración de backups v4 (TAI) y v5 (`crisisstudent`).

### Criterio de aceptación de Fase 2
- Es posible crear, editar, reordenar y borrar bloques desde el store.
- Un backup antiguo de TAI (`schemaVersion: 4`, `appName: 'tai-study'`) se importa sin errores.
- Un backup nuevo con bloques arbitrarios (`schemaVersion: 5`, `appName: 'crisisstudent'`) se exporta e importa sin errores.

---

## Fase 3 — UI de Gestión de Bloques / Asignaturas

**Meta:** Permitir al usuario gestionar sus bloques/asignaturas desde la interfaz y ofrecer una experiencia limpia cuando no hay ninguno creado todavía.

### Tareas

- [x] **Nuevo diálogo `BlockEditorDialog` (`src/app/shared/components/block-editor-dialog/`):**
  - Componente standalone (Angular Material Dialog + Tailwind + modo oscuro).
  - Campos:
    - Nombre / Título (obligatorio, ej. *"Historia Contemporánea"*, *"AWS Cloud"*, *"Redes"*).
    - Código / Etiqueta corta (obligatorio, ej. *"HIST"*, *"M1"*, *"Tema A"* — con sugerencia automática a partir del título).
    - Título corto (opcional, por defecto igual al título).
    - Descripción (opcional).
    - Selector visual de color (`BLOCK_COLOR_PRESETS`).
    - Selector visual de icono Material (`BLOCK_ICON_PRESETS`).
  - Sirve tanto para **Crear** como para **Editar** un bloque existente.
- [x] **Menú lateral (`src/app/shared/components/app-shell/app-shell.html` y `.ts`):**
  - Cambiar sección *"Temario TAI"* → *"Asignaturas / Bloques"* (con botón `+` directo para abrir `BlockEditorDialog`).
  - Mostrar estado vacío compacto si aún no hay bloques (botón *"Crear primera asignatura"*).
- [x] **Dashboard (`src/app/features/dashboard/dashboard.html` y `.ts`):**
  - En la sección de bloques/asignaturas:
    - Botón **"+ Nueva asignatura"**.
    - Menú contextual o botones en cada tarjeta para **Editar** y **Eliminar** (con `ConfirmDialog` indicando cuántos temas, preguntas y flashcards se borrarán).
    - Opcional: reordenación por drag & drop (`@angular/cdk/drag-drop`) o botones subir/bajar.
  - Estado vacío acogedor cuando `store.blocks().length === 0`: mensaje de bienvenida a **CrisIsStudent** con botón destacado para crear la primera asignatura o importar un backup `.json`.
- [x] **Vista de bloque (`src/app/features/block-view/block-view.ts` y `.html`):**
  - Botón para editar los datos del bloque actual o eliminarlo (redirigiendo a `/dashboard` tras borrar).
  - Si se navega a un `blockId` inexistente, mostrar mensaje claro con enlace a `/dashboard` en lugar de caer en `'B1'`.
- [x] **Eliminar enlaces/fallbacks hardcodeados a `'B1'` o `'B3'`:**
  - `src/app/features/notes/topic-detail/topic-detail.ts`
  - `src/app/features/planner/kanban-board/kanban-board.html` (enlazar al primer bloque si existe o a `/dashboard`).
  - `src/app/features/schemas/schemas-index/schemas-index.html` (enlazar al primer bloque si existe o a `/dashboard`).
  - `src/app/features/tests/case-study-dialog/case-study-dialog.ts`
  - `src/app/features/tests/question-editor-dialog/question-editor-dialog.ts`
  - `src/app/features/tests/question-import-dialog/question-import-dialog.ts`
  - `src/app/features/flashcards/flashcard-editor-dialog/flashcard-editor-dialog.ts`
  - `src/app/features/flashcards/flashcard-import-dialog/flashcard-import-dialog.ts`

### Criterio de aceptación de Fase 3
- Un usuario nuevo puede abrir la app vacía, crear 2 o 3 asignaturas con color e icono propios, crear temas dentro, editar las asignaturas y eliminar una sin errores en consola ni rutas rotas.

---

## Fase 4 — Adaptar Módulos de Estudio (Tests, Flashcards, Gamificación)

**Meta:** Que todos los módulos avanzados funcionen de forma 100 % dinámica con N bloques y sin referencias obligatorias a TAI/INAP.

### Tareas

- [x] **Motor de Tests y Simulacros:**
  - `src/app/features/tests/utils/test-scoring.util.ts`: calcular `byBlock: Record<string, ScoreBreakdown>` dinámicamente según los `blockId` presentes en las preguntas del intento.
  - `src/app/features/tests/utils/test-generator.util.ts`: en modo `simulation`, iterar sobre `Object.entries(quotas)` en lugar de `['B1', 'B2', 'B3', 'B4']`.
  - `src/app/features/tests/test-launcher/test-launcher.ts` y `.html`:
    - Reemplazar `quotaB1..quotaB4` por `blockQuotas = signal<Record<string, number>>({})` sincronizado con `store.blocks()`.
    - Sustituir botón *"Cuotas oficiales INAP"* por *"Reparto equitativo"* (ej. repartir N preguntas entre todos los bloques con preguntas) y mantener *"Usar todas las disponibles"*.
    - Títulos de sesión genéricos (`Simulacro (${count} preg.)`).
  - `src/app/features/tests/utils/question-import.util.ts`: recibir la lista de `StudyBlock[]` en `QuestionImportDefaults` y resolver `blockId` buscando coincidencia exacta/normalizada por `id`, `code` o `title` (con fallback a `defaultBlockId`). Actualizar ejemplos de importación a ejemplos genéricos.
  - `src/app/features/tests/utils/inap-pdf-parser.util.ts` y `inap-pdf-import-dialog/`: generalizar textos visibles a *"Importar examen PDF (tipo test)"*, manteniendo los filtros de ruido como limpieza genérica de cabeceras de examen.
  - `src/app/features/tests/utils/topic-question-generator.util.ts` y `topic-question-generator-dialog/`: generalizar el prompt de IA para crear preguntas tipo test de alta calidad de cualquier materia (sin exigir formato oficial INAP/TAI).
- [x] **Flashcards y Gamificación:**
  - `src/app/features/flashcards/utils/flashcard-import.util.ts`: aceptar cualquier `blockId` válido presente en los bloques del usuario (o fallback a `defaults.blockId`).
  - Eliminar `src/app/features/flashcards/data/tai-acronyms-seed.ts` y los botones/referencias a *"Cargar pack de siglas TAI"* en `flashcard-review-session`, `flashcard-deck-manager` y `flashcard-import-dialog`.
  - `src/app/features/flashcards/utils/daily-missions.util.ts`:
    - Generalizar textos de misiones (sin referencias a pack TAI ni INAP).
    - Hacer que la misión de siglas solo aparezca si el usuario tiene flashcards etiquetadas como `siglas` (y con título genérico: *"Domina X siglas"*).
  - `src/app/features/flashcards/utils/gamification-streak.util.ts`: actualizar los títulos de nivel XP a nombres genéricos:
    - `['Aprendiz', 'Estudiante Activo', 'Constante', 'Especialista', 'Maestro del Temario', 'Leyenda del Estudio']`.
  - `src/app/features/flashcards/campaign-map/campaign-map.html`: cambiar *"Mapa de Campaña TAI"* → *"Mapa de Progreso"* (o *"Mapa de Campaña"*).

### Criterio de aceptación de Fase 4
- Se pueden crear preguntas, lanzar simulacros con cuotas dinámicas, importar CSV/JSON/PDF y repasar flashcards sobre asignaturas personalizadas con IDs cualesquiera.
- Todos los specs de `tests/` y `flashcards/` pasan sin depender de `B1..B4` ni `TAI_BLOCKS_SEED`.

---

## Fase 5 — Rebranding a `CrisIsStudent`, Limpieza y Verificación Final

**Meta:** Dejar la identidad visual, textos, exportaciones, PWA y documentación alineados con **CrisIsStudent**.

### Tareas

- [ ] **Marca y PWA:**
  - `src/index.html`: `<title>CrisIsStudent — Tu espacio de estudio local-first</title>`, `meta description` y `<noscript>`.
  - `public/manifest.webmanifest`: `name: "CrisIsStudent"`, `short_name: "CrisIsStudent"`, descripción genérica e icono actualizado.
  - `public/icons/`: crear icono SVG nuevo para **CrisIsStudent** (ej. `crisisstudent-icon.svg`) y enlazarlo desde `index.html` y `manifest.webmanifest`.
  - `src/app/shared/components/app-shell/app-shell.html`: logo/monograma y título `CrisIsStudent`, placeholder de búsqueda genérico (*"Buscar temas, etiquetas o apuntes..."*).
- [ ] **Textos y exportaciones restantes:**
  - `src/app/features/dashboard/dashboard.html`: títulos genéricos (*"Panel de estudio"*, *"Tus asignaturas"*, *"Motor de Tests y Simulacros"*, *"Flashcards SM-2"*).
  - `src/app/features/notes/services/topic-export.service.ts`: encabezados de impresión/PDF con **CrisIsStudent** en lugar de **TAI Study**.
  - `src/app/shared/utils/tiptap-markdown.util.ts` y `src/app/features/schemas/utils/markmap-export.util.ts`: fallbacks de nombre de archivo `'apunte'` y `'esquema'` (en lugar de `'apunte-tai'` / `'esquema-tai'`).
  - `src/app/shared/components/global-search-dialog/global-search-dialog.html`: `aria-label` y estado vacío genéricos.
  - Revisar con `grep -rni "\btai\b\|inap" src/ public/` que no quede ninguna referencia residual no deseada (dejando solo la compatibilidad explícita en `BackupService` y el nombre técnico de IndexedDB `TaiStudyDB`).
- [ ] **Verificación obligatoria (según `AGENTS.md`):**
  - Ejecutar suite completa de tests:
    ```bash
    CI=true NG_CLI_ANALYTICS=false HOME=/tmp npx ng test --watch=false
    ```
  - Ejecutar compilación de verificación:
    ```bash
    CI=true NG_CLI_ANALYTICS=false HOME=/tmp npx ng build --configuration development
    ```

---

## 🚀 Roadmap Futuro — Nivel 2 (Opcional, tras completar Nivel 1)

Una vez consolidado el Nivel 1, si necesitas separar por completo distintos objetivos de estudio (por ejemplo, una oposición, un idioma y una certificación técnica sin mezclar sus preguntas ni estadísticas):

- Añadir entidad `StudyWorkspace` (`id`, `name`, `description`, `icon`, `color`, `order`, `createdAt`) en una migración Dexie **v5**.
- Vincular `StudyBlock.workspaceId` al espacio activo.
- Añadir selector de espacio en la cabecera del menú lateral (`AppShell`) y filtrado automático en `StudyStoreService` por `activeWorkspaceId`.
- Permitir exportar/importar tanto el backup completo como un espacio individual.
