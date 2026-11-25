## Descripción

<!-- Resume qué resuelve o añade esta Pull Request y por qué es necesaria. -->

## Tipo de cambio

- [ ] Nueva funcionalidad (`feat`)
- [ ] Corrección de error (`fix`)
- [ ] Refactorización (`refactor`)
- [ ] Documentación (`docs`)
- [ ] Tests / CI / Mantenimiento (`test`, `chore`)

## Checklist

- [ ] Los tests unitarios pasan (`CI=true NG_CLI_ANALYTICS=false npx ng test --watch=false`).
- [ ] La compilación finaliza sin errores (`CI=true NG_CLI_ANALYTICS=false npx ng build --configuration development`).
- [ ] Se respetan las convenciones de `AGENTS.md` (Standalone, Signals, `@if`/`@for`, `inject()`, sin imports directos de Dexie fuera de `src/app/core/db/`).
- [ ] Si hay cambios en modelos/IndexedDB, se ha actualizado `BackupService` manteniendo compatibilidad hacia atrás.
- [ ] Compatible con modo claro y modo oscuro (`dark:`).
