# AGENTS.md — Directrices para Asistentes y Agentes de IA

Este documento define el contexto, las convenciones de ingeniería, las reglas arquitectónicas y los flujos de trabajo que **cualquier agente de Inteligencia Artificial** (Claude, Gemini, Antigravity, GitHub Copilot, Cursor, etc.) debe seguir rigurosamente al trabajar en el repositorio `tai-study`.

---

## 🎯 1. Rol y Misión del Agente

Tu propósito en este proyecto es asistir en la construcción y evolución de **TAI Study**, una aplicación web **local-first** y **PWA** concebida para la preparación integral de las oposiciones a **Técnicos Auxiliares de Informática (TAI)** de la Administración General del Estado (España).

### Principios Inviolables

1. **Local-First Estricto:** La aplicación no depende de un servidor ni de APIs externas para funcionar. Todas las notas, temas, preguntas y métricas se persisten en **IndexedDB** a través de **Dexie.js**. Nunca agregues dependencias obligatorias a servicios cloud sin desacoplarlas tras la interfaz de repositorio.
2. **Respaldo Portable:** Cualquier cambio en los esquemas de datos debe preservar o migrar la compatibilidad con el sistema de copias de seguridad JSON (`BackupService`).
3. **Cero Doble Trabajo para el Usuario:** Las funcionalidades deben potenciar el estudio activo sin obligar al usuario a reescribir datos (ej.: apunte redactado genera esquema mental y flashcards).
4. **Verificación antes de finalizar:** Ejecuta siempre los tests unitarios (`ng test`) y la compilación (`ng build --configuration development`) para confirmar que tu código no introduce regresiones.

---

## 🛠️ 2. Convenciones Tecnológicas y de Stack

El proyecto utiliza **Angular 22** con TypeScript estricto. Se prohíben patrones obsoletos de Angular.

### Angular 22 & TypeScript

- **Solo Componentes Standalone:** No utilices `NgModule`. Todo componente, directiva o pipe es `standalone: true` (o standalone por defecto en Angular moderno) e importa explícitamente sus dependencias en `imports: [...]`.
- **Inyección con `inject()`:** Prefiere `inject(Service)` en propiedades en lugar de inyectar dependencias mediante parámetros en el constructor:
  ```ts
  // ✅ Correcto:
  export class MiComponente {
    private readonly store = inject(StudyStoreService);
    private readonly route = inject(ActivatedRoute);
  }

  // ❌ Prohibido:
  constructor(private store: StudyStoreService) {}
  ```
- **Angular Signals para Estado y Reactividad:**
  - Usa `signal()`, `computed()`, y `effect()` para el estado local y global.
  - Usa `toSignal()` de `@angular/core/rxjs-interop` para transformar observables de rutas o parámetros.
  - Evita suscripciones manuales (`.subscribe()`) a menos que sea estrictamente necesario; si las usas, límpialas con `DestroyRef` o `takeUntilDestroyed()`.
- **Nuevo Control Flow:** Usa la sintaxis nativa de control de flujo de Angular (`@if`, `@else`, `@for (item of items; track item.id)`, `@switch`, `@empty`), nunca directivas estructurales antiguas (`*ngIf`, `*ngFor`).

### Estilos y Diseño Visual

- **Tailwind CSS v4:** Clases utilitarias directas en plantillas HTML.
- **Angular Material & CDK:** Utilizados para componentes accesibles (`MatButtonModule`, `MatIconModule`, `MatDialogModule`, `MatSnackBarModule`) y funcionalidades avanzadas como `drag-drop` (`@angular/cdk/drag-drop`).
- **Soporte de Tema Oscuro/Claro:** Toda interfaz debe ser compatible con modo oscuro mediante las clases `dark:` de Tailwind y tokens de color de Material.

---

## 🏛️ 3. Arquitectura del Código

El código está estructurado en tres capas principales dentro de `src/app/`:

```text
src/app/
├── core/
│   ├── db/              # Esquema Dexie.js (StudyDatabase), migraciones y seed inicial
│   ├── models/          # Interfaces TypeScript del dominio (TaiBlock, Topic, etc.)
│   ├── repositories/    # Interfaces de persistencia (StudyRepository) e implementación Dexie
│   └── services/        # Store global con Signals (StudyStoreService), Backup, Theme
├── shared/
│   ├── components/      # UI genérica reutilizable (AppShell, ConfirmDialog, etc.)
│   └── utils/           # Utilidades puras, convertidores TipTap -> Markdown, helpers SRS
└── features/
    ├── dashboard/       # Vista general, progreso por bloque, métricas
    ├── block-view/      # Lista de temas de un bloque, drag-and-drop reordering, filtros
    ├── notes/           # Editor TipTap, detalle de tema (topic-detail), importación Word
    ├── schemas/         # Mapas mentales Markmap (Fase 1)
    ├── planner/         # Kanban de vueltas, heatmap, Pomodoro (Fase 2)
    ├── tests/           # Simulacros INAP, test por temas, penalización -1/3 (Fase 3)
    └── flashcards/      # Repaso espaciado SM-2 y gamificación (Fase 4)
```

### Patrón Repositorio y Store Central

1. **`STUDY_REPOSITORY`:** Es un `InjectionToken<StudyRepository>`. La UI o los componentes nunca llaman a Dexie directamente.
2. **`StudyStoreService`:** Gestiona el estado reactivo centralizado mediante Signals (`blocks`, `topics`, `searchQuery`, `totalTopics`, etc.).
3. **Mocks en Tests:** En los tests unitarios (`*.spec.ts`), provee siempre un `MockStudyRepository` en lugar de instanciar la base de datos real IndexedDB.

---

## ⚡ 4. Guía de Ejecución y Comandos Críticos

En entornos de ejecución de agentes (sandboxes o terminales restringidos), utiliza los siguientes comandos exactos:

### Ejecución de Pruebas Unitarias

```bash
CI=true NG_CLI_ANALYTICS=false HOME=/tmp npx ng test --watch=false
```

_Motivo:_ Previene bloqueos por prompts interactivos de autocompletado y telemetría de Angular CLI.

### Compilación Offline / Sandbox

```bash
CI=true NG_CLI_ANALYTICS=false HOME=/tmp npx ng build --configuration development
```

_Motivo:_ En producción (`ng build`), el builder intenta optimizar e integrar fuentes web externas (`fonts.googleapis.com`). Sin acceso a internet, esa descarga falla. El flag `--configuration development` evita la descarga de fuentes y compila perfectamente en entornos locales/aislados.

---

## 📋 5. Reglas para Modificar el Modelo de Datos

1. **Modelos:** Modifica primero `src/app/core/models/study.models.ts`.
2. **Base de Datos:** Actualiza `src/app/core/db/study.db.ts`. Si alteras índices o tablas existentes, incrementa la versión de Dexie con `this.version(N).stores(...)` para no romper bases de datos locales ya existentes de los usuarios.
3. **Repositorio:** Añade los métodos correspondientes en `StudyRepository` e impleméntalos en `IndexedDbStudyRepository`.
4. **Store:** Expón las Signals o métodos de mutación necesarios en `StudyStoreService`.
5. **Backup:** Revisa `src/app/core/services/backup.service.ts` para asegurar que las nuevas entidades se incluyan en el payload de exportación e importación `.json`.
6. **Tests:** Añade las aserciones correspondientes en `study-store.service.spec.ts` y `backup.service.spec.ts`.

---

## 🚫 6. Qué NO Hacer (Anti-Patrones)

- ❌ **NO introducir llamadas HTTP sin abstraer:** No hagas `fetch()` o `HttpClient` a APIs propietarias o servidores backend que hagan que la aplicación deje de funcionar offline.
- ❌ **NO mutar estados de Signals directamente fuera del store:** Las modificaciones de temas y bloques deben pasar por los métodos del `StudyStoreService`.
- ❌ **NO usar directivas estructurales obsoletas:** Prohibido `*ngIf`, `*ngFor`, `*ngSwitch`. Usa `@if`, `@for`, `@switch`.
- ❌ **NO usar módulos NgModule:** Ningún componente nuevo debe declararse en un módulo.
- ❌ **NO romper los tests existentes:** Ejecuta siempre la suite de pruebas antes de dar una tarea por completada.
- ❌ **NO sobreescribir `PLAN.md`:** `PLAN.md` es el documento de referencia histórica y funcional acordado. Puedes actualizar los checkboxes de progreso (`- [x]`), pero respeta su diseño general.

---

## 📌 7. Referencias Rápidas

- [README.md](file:///Users/csanzfer/workspace/study/README.md) — Visión general y puesta en marcha del proyecto.
- [PLAN.md](file:///Users/csanzfer/workspace/study/PLAN.md) — Plan maestro de análisis funcional y backlog por fases.
- [CONTEXT.md](file:///Users/csanzfer/workspace/study/CONTEXT.md) — Contexto de negocio y programa oficial de las oposiciones TAI.
- [ARCHITECTURE.md](file:///Users/csanzfer/workspace/study/ARCHITECTURE.md) — Detalles técnicos y arquitectura de componentes.
