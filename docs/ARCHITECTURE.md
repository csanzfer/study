# ARCHITECTURE.md — Arquitectura del Sistema CrisIsStudent

Este documento describe la arquitectura de software, los patrones de diseño, el flujo de datos y las estrategias de almacenamiento de **CrisIsStudent**.

---

## 🏛️ 1. Visión Arquitectónica General

CrisIsStudent sigue una arquitectura **Clean Client-Side** desacoplada mediante interfaces de repositorio y reactividad pura basada en **Angular Signals**. Toda la lógica de negocio y persistencia se ejecuta en el navegador del usuario (**Local-First**).

```mermaid
flowchart TD
    subgraph UI["Capa de Presentación (Angular 22)"]
        Shell["AppShell Component\n(Sidebar, Header, Search)"]
        Dashboard["Dashboard Component"]
        BlockView["BlockView Component\n(Topic List, Drag-Drop & Block Export)"]
        TopicDetail["TopicDetail Component\n(Editor, Metadata, Outline & MD/PDF Export)"]
        Tests["Tests & PDF Importer\n(pdfjs-dist local worker)"]
        Flashcards["Flashcards SRS & Gamification"]
        Guide["GuidePage Component\n(Guía interactiva integrada)"]
    end

    subgraph State["Capa de Estado Reactivo"]
        Store["StudyStoreService\n(Signals: blocks, topics, searchQuery)"]
        Backup["BackupService\n(Export/Import JSON)"]
        Theme["ThemeService\n(Light/Dark Mode)"]
    end

    subgraph Domain["Capa de Dominio & Abstracción"]
        RepoToken["InjectionToken: STUDY_REPOSITORY"]
        RepoInterface["Interface: StudyRepository"]
        Models["Domain Models\n(StudyBlock, Topic, Status, Backup)"]
    end

    subgraph Storage["Capa de Persistencia Local"]
        RepoImpl["IndexedDbStudyRepository"]
        DexieDB["StudyDatabase (Dexie.js)"]
        BrowserIDB[("IndexedDB del Navegador\n'TaiStudyDB'")]
        DiskJSON[("Archivo Backup\n.json")]
    end

    Shell --> Store
    Dashboard --> Store
    BlockView --> Store
    TopicDetail --> Store
    Tests --> Store
    Flashcards --> Store

    Shell --> Backup
    Shell --> Theme

    Store --> RepoToken
    Backup --> RepoToken
    RepoToken -.-> RepoInterface
    RepoInterface <|.. RepoImpl

    RepoImpl --> DexieDB
    DexieDB --> BrowserIDB
    Backup --> DiskJSON
```

---

## 🧩 2. Estructura de Capas

### 2.1. Capa de Presentación (`src/app/features/` & `src/app/shared/`)

- **Componentes Standalone:** Cada vista es un componente standalone con lazy-loading en `app.routes.ts`.
- **Inyección Unidireccional:** Los componentes inyectan `StudyStoreService` para leer datos mediante Signals calculadas (`computed()`) y disparar mutaciones mediante métodos del store (`createTopic()`, `updateTopic()`, `reorderTopics()`, `deleteTopic()`).
- **Diseño Adaptable (Responsive):** Clases utilitarias de Tailwind v4 combinadas con Angular Material para modales y notificaciones (`MatDialog`, `MatSnackBar`).

### 2.2. Capa de Estado Reactivo (`src/app/core/services/`)

- **`StudyStoreService`:** Es el único punto de contacto para la UI sobre el estado global de la app.
  - Señales primarias:
    - `blocks = signal<StudyBlock[]>([])`
    - `topics = signal<Topic[]>([])`
    - `studySessions = signal<StudySession[]>([])`
    - `weeklyPlanItems = signal<WeeklyPlanItem[]>([])`
    - `searchQuery = signal('')`
    - `loading = signal(false)`
    - `initialized = signal(false)`
  - Señales derivadas (`computed`):
    - `totalTopics`, `masteredTopics`, `totalRoundsCompleted`.
    - `topicCountByBlock`: mapa de recuento de temas por bloque dinámico.
    - `rustyTopics`: temas oxidados/críticos ordenados por urgencia de repaso.
    - `studyMinutesThisWeek`, `studyMinutesByBlockThisWeek`, `studyMinutesByBlockTotal`.
    - `filteredTopics`: filtrado en memoria por búsqueda sobre título, texto plano o etiquetas.
- **`PomodoroService`:** Temporizador global con Signals persistente durante la navegación entre vistas; guarda automáticamente `StudySession` al finalizar bloques de enfoque y actualiza `lastReviewedAt`.
- **`BackupService`:** Orquesta la exportación de la base de datos a un archivo descargable `crisisstudent-backup-YYYY-MM-DD.json` con `schemaVersion: 5` (retrocompatible con backups anteriores `v1`–`v4` de `tai-study`), validando esquemas durante la restauración.
- **`ThemeService`:** Persiste y conmuta el modo visual (`light` / `dark`) actualizando la clase CSS en el elemento raíz `<html>`.

### 2.3. Capa de Repositorio y Dominio (`src/app/core/repositories/` & `src/app/core/models/`)

- **Abstracción:** Se define la interfaz `StudyRepository`:
  ```ts
  export interface StudyRepository {
    initialize(): Promise<void>;
    getBlocks(): Promise<StudyBlock[]>;
    saveBlock(block: StudyBlock): Promise<void>;
    saveBlocks(blocks: StudyBlock[]): Promise<void>;
    deleteBlock(id: StudyBlockId): Promise<void>;
    getTopics(blockId?: StudyBlockId): Promise<Topic[]>;
    getTopicById(id: string): Promise<Topic | undefined>;
    saveTopic(topic: Topic): Promise<void>;
    saveTopics(topics: Topic[]): Promise<void>;
    deleteTopic(id: string): Promise<void>;
    // ... sesiones, planificador, supuestos, preguntas, intentos, flashcards y gamificación
  }
  ```
- **Injection Token:** `STUDY_REPOSITORY` permite sustituir con facilidad la implementación real por un repositorio en memoria (`MockStudyRepository`) en pruebas unitarias, o un futuro `CloudStudyRepository` para sincronización en la nube (Fase 5).

### 2.4. Capa de Persistencia (`src/app/core/db/`)

- **Dexie.js (`StudyDatabase`):** Extiende de `Dexie` conservando el nombre de base de datos `TaiStudyDB` para mantener compatibilidad sin pérdida de datos con instalaciones previas.
- **Esquema Actual (Versión 4):**
  ```ts
  this.version(4).stores({
    blocks: 'id, order',
    topics: 'id, blockId, order, status, updatedAt, lastReviewedAt, *tags',
    studySessions: 'id, topicId, blockId, startedAt, type',
    weeklyPlanItems: 'id, weekStartDate, [weekStartDate+dayOfWeek], topicId, blockId',
    caseStudies: 'id, blockId, updatedAt, *tags',
    questions: 'id, blockId, topicId, caseStudyId, flagged, updatedAt, *tags',
    examAttempts: 'id, date, mode, caseStudyId',
    flashcards: 'id, blockId, topicId, srs.dueDate, updatedAt, *tags',
    gamification: 'id',
  });
  ```
- **Bloques Dinámicos:** Las instalaciones nuevas arrancan limpias sin bloques predefinidos para que cada estudiante cree su propia estructura de materias. El borrado de un bloque ejecuta una transacción Dexie en cascada para evitar registros huérfanos.
- **Persistencia Robusta:** Invoca `navigator.storage.persist()` para pedir al navegador que marque el almacenamiento como persistente, evitando desalojos por baja memoria.

---

## 🔄 3. Ciclo de Vida de los Datos y Flujo de Operaciones

### Flujo de Creación / Actualización de un Tema

```mermaid
sequenceDiagram
    autonumber
    actor User as Opositor
    participant View as TopicDetail / BlockView
    participant Store as StudyStoreService
    participant Repo as StudyRepository (IndexedDb)
    participant DB as Dexie (IndexedDB)

    User->>View: Modifica título / estado / contenido
    View->>Store: updateTopic(id, patch)
    Store->>Repo: saveTopic(updatedTopic)
    Repo->>DB: topics.put(updatedTopic)
    DB-->>Repo: Confirmado
    Store->>Store: topics.update(...) (Actualiza Signal)
    Store-->>View: UI reactiva se actualiza instantáneamente
```

---

## 🛡️ 4. Estrategia Offline y PWA

1. **Service Worker (@angular/service-worker):**
   - Configurado en `ngsw-config.json`.
   - Estrategia de recursos estáticos: `prefetch` para los bundles JavaScript, CSS, HTML principal e iconos SVG.
2. **Web App Manifest (`public/manifest.webmanifest`):**
   - Nombre: `crisisstudent — Espacio de estudio local-first`
   - Modo de visualización: `standalone` (sin barras del navegador).
   - Color de tema: `#0891b2` (cian primario).
   - Totalmente instalable en macOS, Windows, Linux, iOS y Android.

---

## 🧪 5. Arquitectura de Testing

- **Ejecutor:** Vitest v5 integrado en Angular CLI (`@angular/build:unit-test`).
- **Aislamiento de Pruebas:**
  - Los tests de componentes y servicios nunca tocan IndexedDB directamente.
  - Implementan un `MockStudyRepository` en memoria que simula la persistencia.
  - La suite se ejecuta en menos de 1 segundo de forma totalmente desacoplada del sistema operativo o el navegador físico.
