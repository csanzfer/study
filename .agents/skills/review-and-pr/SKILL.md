---
name: review-and-pr
description: >-
  Revisa de forma exhaustiva el código de la rama actual de TAI Study (tests,
  compilación, reglas de AGENTS.md, bugs y edge cases), aplica correcciones si
  el usuario lo solicita y, solo tras su validación y aprobación explícita,
  genera la Pull Request contra main. Úsalo cuando el usuario pida revisar la
  rama, comprobar que todo está correcto o preparar/crear una PR.
---

# Revisión de Rama y Creación de PR (`review-and-pr`)

Este procedimiento guía al agente para auditar la rama de trabajo actual de **TAI Study**, validar cualquier corrección con el usuario y crear la Pull Request únicamente bajo su aprobación explícita.

## Regla de Oro

> **Nunca** hagas `git push` ni ejecutes `gh pr create` de forma unilateral. Debes presentar el informe de revisión, resolver los cambios acordados y obtener una **confirmación explícita del usuario** antes de abrir la PR.

---

## Paso 1: Contexto Git y Verificación Automática

1. Comprueba el estado de la rama y el alcance de los cambios frente a `main`:
   - `git status`
   - `git log --oneline -n 10`
   - `git diff --stat main...HEAD`
2. Ejecuta los checks obligatorios de `AGENTS.md`:
   - Tests unitarios:
     ```bash
     CI=true NG_CLI_ANALYTICS=false HOME=/tmp npx ng test --watch=false
     ```
   - Compilación offline/development:
     ```bash
     CI=true NG_CLI_ANALYTICS=false HOME=/tmp npx ng build --configuration development
     ```
3. Verifica las restricciones arquitectónicas de `AGENTS.md`:
   ```bash
   grep -rnE "\*ngIf|\*ngFor|\*ngSwitch|@NgModule|HttpClient|from 'dexie'" src/app/
   ```
   - Solo `src/app/core/db/` puede importar `dexie`.
   - No debe haber directivas estructurales heredadas, `@NgModule` ni `HttpClient`.

---

## Paso 2: Revisión Técnica del Código

Inspecciona los archivos nuevos y modificados en la rama poniendo foco en:

1. **Modelo de datos y persistencia local-first:**
   - Cambios en `study.models.ts`, incremento de versión en `StudyDatabase` (`study.db.ts`) si cambian tablas/índices, y consistencia en `StudyRepository` / `IndexedDbStudyRepository`.
   - Compatibilidad y validación estricta en `BackupService` (exportación e importación retrocompatible).
2. **Estado, reactividad y concurrencia:**
   - Uso de `inject()`, Signals (`signal`, `computed`, `effect`), `toSignal()` y ausencia de mutaciones directas fuera de `StudyStoreService`.
   - Condiciones de carrera en operaciones `async`, doble clic, temporizadores y limpieza de suscripciones.
3. **UI, UX y Angular 22:**
   - Componentes standalone, control flow nativo (`@if`, `@for`, `@switch`), accesibilidad básica y soporte de tema oscuro (`dark:`).
   - Casos límite: listas vacías, entidades eliminadas, validaciones de formularios.
4. **Tests y documentación:**
   - Cobertura unitaria de la nueva lógica (usando mocks de `STUDY_REPOSITORY`, nunca IndexedDB real).
   - Actualización coherente de `PLAN.md` (solo checkboxes) y `ARCHITECTURE.md` si aplica.

---

## Paso 3: Informe y Puerta de Aprobación con el Usuario

Presenta al usuario un informe conciso en español estructurado así:

1. **Estado general:** resultado de `ng test`, `ng build` y cumplimiento de `AGENTS.md`.
2. **Hallazgos priorizados** (si los hay): bugs o riesgos primero, mejoras menores después, citando archivo y líneas.
3. **Siguiente acción:**
   - Si hay incidencias: pregunta si desea que apliques las correcciones (y añadas sus tests) antes de continuar.
   - Tras aplicar correcciones (si las hubo), vuelve a ejecutar `ng test --watch=false` y `ng build --configuration development` e informa del nuevo resultado.
   - **Pide confirmación explícita** antes de pasar al Paso 4 (crear la PR hacia `main`).

---

## Paso 4: Creación de la Pull Request (Solo tras Aprobación Explícita)

Ejecuta este paso **únicamente** después de que el usuario haya validado la revisión y aprobado expresamente generar la PR:

1. Comprueba `git status` y `git log` para verificar si existen cambios pendientes de commit o push:
   - Si hay cambios locales sin subir, haz commit con un mensaje claro (Conventional Commits) y ejecuta `git push -u origin <rama-actual>`.
2. Redacta el cuerpo de la PR en un archivo temporal (por ejemplo en el directorio scratch) con:
   - **Resumen** y lista de cambios principales agrupados por capa.
   - **Verificación** (número de tests pasando y resultado de `ng build`).
3. Crea la PR usando `--body-file` (evita problemas de escapado de backticks en shell):
   ```bash
   gh pr create --base main --head <rama-actual> --title "<título>" --body-file <ruta-body.md>
   ```
4. Devuelve al usuario el enlace de la PR creada y confirma el título y rama base/origen.
