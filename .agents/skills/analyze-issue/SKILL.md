---
name: analyze-issue
description: >-
  Lee una issue de GitHub de TAI Study, investiga el código real del repositorio
  y genera un plan técnico de implementación detallado (modelo de datos, Dexie,
  Backup, archivos exactos, pasos ordenados, edge cases y tests) para publicarlo
  o actualizarlo como comentario en la propia issue. Pensado para analizar con
  un modelo fuerte y facilitar luego el desarrollo con un modelo más ligero.
  Úsalo cuando el usuario pida analizar una issue, preparar una issue para
  desarrollo o comentar el plan técnico en una issue de GitHub.
---

# Análisis Técnico de Issues de GitHub (`analyze-issue`)

Este procedimiento guía al agente para analizar a fondo una issue de GitHub de **TAI Study** inspeccionando el código real del repositorio y dejar un **plan técnico autocontenido** como comentario en la propia issue, de modo que posteriormente pueda implementarse de forma rápida y fiable con un modelo más ligero.

> **Alcance de solo lectura:** Esta skill es únicamente de análisis y planificación. **No** modifiques archivos del repositorio, ni crees ramas o commits.

---

## Paso 1: Obtener la Issue de GitHub

1. Si el usuario ha indicado un número o URL de issue, extrae su número (`<numero>`) y léela completa (incluyendo etiquetas y comentarios previos):
   ```bash
   gh issue view <numero> --json number,title,body,labels,state,comments,url
   ```
2. Si el usuario **no** indicó qué issue analizar, lista las issues abiertas y pregúntale cuál quiere analizar:
   ```bash
   gh issue list --state open --limit 20
   ```
3. Comprueba en `comments` si ya existe un comentario previo con el marcador `<!-- tai-study-issue-analysis -->` para tener en cuenta el análisis anterior y posibles respuestas posteriores (el ID numérico para actualizarlo en GitHub se obtendrá en el Paso 4 mediante la API REST).

---

## Paso 2: Investigar el Código Real del Repositorio

Antes de redactar el plan, inspecciona el código afectado para que **ninguna ruta, interfaz, señal o firma sea inventada**:

1. **Reglas y arquitectura:** Ten siempre presentes las restricciones de `AGENTS.md` y `docs/ARCHITECTURE.md`:
   - Local-first estricto (Dexie/IndexedDB, sin `HttpClient` ni dependencias cloud).
   - Angular 22 standalone, `inject()`, Signals (`signal`, `computed`, `effect`, `toSignal`), control flow nativo (`@if`, `@for`, `@switch`).
   - Solo `src/app/core/db/` puede importar `dexie`.
   - Toda mutación de estado global pasa por `StudyStoreService`.
   - Compatibilidad de `BackupService` y soporte de tema oscuro (`dark:`).
2. **Capa de datos (si aplica):** Revisa `src/app/core/models/study.models.ts`, `src/app/core/db/study.db.ts`, `src/app/core/repositories/study.repository.ts`, `src/app/core/services/study-store.service.ts` y `src/app/core/services/backup.service.ts`.
3. **Capa de UI / Feature:** Lee los componentes, servicios, utilidades y archivos `*.spec.ts` relacionados en `src/app/features/` y `src/app/shared/`, además de `src/app/app.routes.ts` si requiere nuevas rutas.
4. **Referencia funcional:** Si la issue alude a una fase del proyecto, consulta la sección correspondiente de `docs/PLAN.md` o `docs/PLAN_CRISISSTUDENT.md`.

---

## Paso 3: Redactar el Plan Técnico (Plantilla Estándar)

Redacta el análisis en **español** con precisión quirúrgica para que un modelo más pequeño pueda ejecutarlo paso a paso sin tener que re-explorar toda la arquitectura.

Incluye siempre el marcador en la primera línea y estas secciones:

````markdown
<!-- tai-study-issue-analysis -->
## 🧭 Análisis técnico y plan de implementación

> _Análisis generado sobre el estado actual del repositorio para facilitar la implementación directa._

### 1. Resumen y alcance
- **Objetivo:** Qué resuelve la issue en 2-3 líneas.
- **Dentro de alcance:** Lista concreta de comportamientos esperados.
- **Fuera de alcance:** Qué no se debe tocar para evitar sobreingeniería.

### 2. Impacto en modelo de datos, Dexie y Backup
_(Indicar explícitamente "Sin cambios en modelo de datos, Dexie ni Backup" si no aplica. Si aplica, especificar exactamente:)_
- **Modelos (`src/app/core/models/study.models.ts`):** Interfaces/campos nuevos o modificados con tipos exactos.
- **Base de datos (`src/app/core/db/study.db.ts`):** Si cambian tablas o índices, indicar el incremento de `this.version(N).stores(...)` y la migración `.upgrade(...)` si es necesaria.
- **Repositorio (`src/app/core/repositories/study.repository.ts`):** Métodos a añadir/ajustar en `StudyRepository` e `IndexedDbStudyRepository`.
- **Store (`src/app/core/services/study-store.service.ts`):** Signals primarias, `computed()` y métodos públicos de mutación.
- **Backup (`src/app/core/services/backup.service.ts`):** Inclusión en exportación/importación y retrocompatibilidad con backups previos.

### 3. Archivos a crear o modificar
| Archivo | Acción | Cambios clave |
| --- | --- | --- |
| `src/app/...` | Modificar / Crear | Descripción concreta de símbolos, métodos o bloques HTML |

### 4. Plan de implementación paso a paso
1. **[Capa / archivo]:** Instrucción concreta y verificable (incluyendo firmas, nombres de signals o selectores clave cuando aporte claridad).
2. ...

### 5. Casos límite (edge cases) y restricciones de `AGENTS.md`
- Casos límite reales: estados vacíos, datos antiguos en IndexedDB/backup, concurrencia `async`, validaciones, accesibilidad y modo oscuro (`dark:`).
- Recordatorios críticos aplicables a esta issue (ej. no usar `*ngIf`/`*ngFor`, usar `inject()`, no importar `dexie` fuera de `core/db/`).

### 6. Plan de tests y verificación
- **Tests unitarios a crear/actualizar:** Indicar cada `*.spec.ts` y los escenarios exactos a probar (usando mocks de `STUDY_REPOSITORY`, nunca IndexedDB real).
- **Comandos de verificación obligatorios:**
  ```bash
  CI=true NG_CLI_ANALYTICS=false HOME=/tmp npx ng test --watch=false
  CI=true NG_CLI_ANALYTICS=false HOME=/tmp npx ng build --configuration development
  ```

### 7. Preguntas abiertas / Ambigüedades
_(Omitir o indicar "Ninguna" si los requisitos están totalmente claros. Si hay decisiones de producto o UX ambiguas, enumerarlas aquí con una opción recomendada.)_
````

---

## Paso 4: Publicar o Actualizar el Comentario en GitHub

1. Guarda el Markdown del análisis en un archivo temporal **fuera del árbol del repositorio** (por ejemplo, en el directorio scratch o `/tmp`) para evitar problemas de escapado de backticks o comillas en shell y no ensuciar `git status`.
2. Busca el ID numérico (REST) de un posible comentario previo con el marcador `<!-- tai-study-issue-analysis -->` usando siempre el `<numero>` numérico de la issue:
   ```bash
   gh api --paginate --slurp repos/{owner}/{repo}/issues/<numero>/comments --jq '[.[][] | select((.body // "") | contains("<!-- tai-study-issue-analysis -->"))] | last | .id // empty'
   ```
3. Realiza el **upsert**:
   - **Si ya existe un `comment_id`:** actualízalo en sitio y obtén su enlace directo:
     ```bash
     gh api -X PATCH repos/{owner}/{repo}/issues/comments/<comment_id> -F body=@<ruta-analisis.md> --jq .html_url
     ```
   - **Si no existe:** crea un comentario nuevo:
     ```bash
     gh issue comment <numero> --body-file <ruta-analisis.md>
     ```
4. Devuelve al usuario:
   - Enlace directo al comentario publicado/actualizado en la issue.
   - Resumen breve (3-5 líneas) de los archivos principales implicados y si hay alguna pregunta abierta que convenga aclarar antes de pasar al desarrollo.
