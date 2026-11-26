# PLAN_SUPABASE.md — Sincronización Multidispositivo con Supabase (`CrisIsStudent`)

> **Objetivo:** Añadir sincronización multidispositivo opcional con **Supabase** preservando al 100 % el principio **local-first** de CrisIsStudent. La aplicación sigue funcionando sin cuenta ni conexión a internet sobre IndexedDB (Dexie.js), y sincroniza deltas en segundo plano cuando el usuario inicia sesión.

---

## 🎯 Decisiones Acordadas

1. **Modelo de usuarios:** **Solo por invitación** (gestionado desde el Dashboard de Supabase → *Authentication → Users → Invite user*, con el registro abierto desactivado).
2. **Autenticación:** **Email + Contraseña** con flujo **PKCE** (soporte nativo para enlaces de invitación, fijación inicial de contraseña y recuperación de contraseña).
3. **Estrategia de sincronización (v1):** **Push/Pull incremental** por entidad (subida con debounce de 1.5 s + bajada al iniciar sesión, al abrir la app, al volver a la pestaña, al recuperar conexión o con botón manual). *Supabase Realtime queda como Fase 4 opcional.*
4. **Resolución de conflictos:** **Last-Write-Wins (LWW) puro** en todas las tablas usando `updatedAt` y cursor de servidor `server_updated_at`, con borrado lógico (**soft-delete `deleted_at`**) en la nube para propagar eliminaciones entre dispositivos offline.
5. **Primera sincronización y cierre de sesión:**
   - Si al iniciar sesión hay datos tanto en local como en la nube, se muestra un **diálogo explícito** con botón previo de descarga de backup `.json` y 3 opciones: **Fusionar (LWW)**, **Usar datos de la nube** o **Subir datos locales**.
   - Al cerrar sesión se pregunta si **mantener datos locales offline** o **borrar IndexedDB local**.
   - Si otro usuario distinto inicia sesión en el mismo navegador, se exige limpiar datos locales (con opción de backup previo) para no mezclar cuentas.
6. **Configuración y despliegue:** `SUPABASE_URL` y `SUPABASE_ANON_KEY` se inyectan en CI mediante **GitHub Actions Variables** en `.github/workflows/deploy-pages.yml` y en local mediante un archivo gitignored (`src/environments/environment.local.ts`). Sin credenciales configuradas, la app arranca en modo 100 % local-first sin errores.

---

## 📊 Resumen de Progreso

- [x] **Fase 0:** Migraciones SQL + RLS + SDK `@supabase/supabase-js` + Configuración de entornos y CI
- [x] **Fase 1:** `SupabaseAuthService` + UI de inicio de sesión, invitación/reset y cierre de sesión
- [x] **Fase 2:** Dexie v5 (`updatedAt`, `syncOutbox`, `syncMeta`) + `SyncingStudyRepository` + `SupabaseSyncService`
- [x] **Fase 3:** Flujo de primera sincronización, diálogo de conflicto inicial, indicadores de estado en `AppShell` y tests completos
- [ ] **Fase 4 (Opcional / Futuro):** Supabase Realtime, SMTP propio (Resend/Brevo) y Edge Functions de administración/eliminación de cuenta

---

## 🏛️ Arquitectura de Sincronización

- **Fuente de verdad inmediata:** IndexedDB (`TaiStudyDB` v5) mediante `IndexedDbStudyRepository`.
- **Decorador de repositorio:** `SyncingStudyRepository` implementa `StudyRepository` y se provee bajo `STUDY_REPOSITORY`. Cada mutación escribe primero en Dexie y, si hay sesión activa, registra el cambio en `syncOutbox` dentro de la misma transacción.
- **Motor de sincronización:** `SupabaseSyncService` agrupa cambios del `syncOutbox` (debounce 1.5 s), hace `upsert` por lotes en Postgres y ejecuta `pull()` incremental (`server_updated_at > lastPulledAt`) aplicando cambios remotos directamente en Dexie (sin re-encolarlos) y refrescando `StudyStoreService`.

---

## 🔐 Checklist de Seguridad (Configuración en Supabase Dashboard)

Cuando crees tu proyecto en Supabase, sigue estos pasos para dejarlo listo y seguro:

1. **Ejecutar la migración SQL:** Copia y ejecuta el contenido de `supabase/migrations/20261126000001_initial_schema.sql` en el *SQL Editor* de Supabase. Esto crea las 9 tablas de estudio, `profiles`, índices, triggers de `server_updated_at` y políticas **RLS** estrictas (solo rol `authenticated`, nunca `anon`).
2. **Desactivar registro público:** En *Authentication → Providers → Email*, desactiva **Allow new users to sign up** (o *Enable Sign Ups*).
3. **Configurar URLs permitidas:** En *Authentication → URL Configuration*:
   - **Site URL:** `https://csanzfer.github.io/study/`
   - **Redirect URLs:** `http://localhost:4200/**` y `https://csanzfer.github.io/study/**`
4. **Configurar GitHub Actions Variables** (en tu repo → *Settings → Secrets and variables → Actions → Variables*):
   - `SUPABASE_URL`: URL de tu proyecto (`https://xxxx.supabase.co`)
   - `SUPABASE_ANON_KEY`: clave pública `anon` / `publishable` (nunca `service_role`)
5. **Configuración local (opcional para desarrollo):** Crea `src/environments/environment.local.ts` (ignorado por Git) copiando la plantilla de `src/environments/environment.local.example.ts`.
6. **Dar de alta usuarios:** Desde *Authentication → Users → Invite user*. El invitado recibirá un correo con enlace para entrar en la app y establecer su contraseña.

---

## ⚠️ Notas Operativas

- **Plan Gratuito de Supabase:** 500 MB de base de datos, 50.000 MAU y 5 GB de egress. Recuerda que los proyectos gratuitos se pausan tras **7 días de inactividad**; si ocurre, CrisIsStudent seguirá funcionando offline sin perder datos y sincronizará en cuanto reactives el proyecto.
- **Service Worker (`ngsw-config.json`):** Solo cachea assets estáticos locales; las peticiones a `*.supabase.co` nunca se cachean en el Service Worker.
