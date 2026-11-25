# CrisIsStudent — Espacio de Estudio Local-First y PWA

> Aplicación web **local-first** y **PWA** de estudio activo: organiza cualquier materia o temario con apuntes enriquecidos, mapas mentales automáticos, planificación por vueltas, temporizador Pomodoro, simulacros de examen y tarjetas de repaso espaciado (SM-2), **100% en tu navegador y sin servidor**.

[![Demo en Vivo](https://img.shields.io/badge/Demo%20en%20Vivo-GitHub%20Pages-0891b2?style=flat-square&logo=githubpages&logoColor=white)](https://csanzfer.github.io/study/)
[![CI](https://github.com/csanzfer/study/actions/workflows/pr-review.yml/badge.svg?branch=main)](https://github.com/csanzfer/study/actions/workflows/pr-review.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-0891b2?style=flat-square)](./LICENSE)
![Angular](https://img.shields.io/badge/Angular-22-dd0031?style=flat-square&logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178c6?style=flat-square&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8?style=flat-square&logo=tailwindcss&logoColor=white)
![Dexie.js](https://img.shields.io/badge/Dexie.js-IndexedDB-f97316?style=flat-square)
![Vitest](https://img.shields.io/badge/Vitest-5.0-6e9f18?style=flat-square&logo=vitest&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Offline%20Ready-10b981?style=flat-square)

> [!TIP]
> **🚀 Pruébala ahora mismo sin instalar nada:** [Abrir Demo en Vivo (CrisIsStudent)](https://csanzfer.github.io/study/) — todos los datos se guardan en el IndexedDB de tu navegador.

---

## 📖 Descripción General

**CrisIsStudent** resuelve la fricción habitual entre tomar apuntes y practicar el estudio activo. En lugar de repartir tu temario entre documentos sueltos, hojas de cálculo y apps de pago en la nube, centraliza todo el flujo de estudio en una única aplicación rápida, privada y disponible sin conexión.

### 💡 Principios Fundamentales

1. **Local-First Real:** Tus datos permanecen en tu dispositivo mediante **IndexedDB (Dexie.js)**. No requiere registro, backend ni conexión a internet continua.
2. **Cero Doble Trabajo:** Los apuntes redactados o importados desde Word/Markdown alimentan automáticamente los mapas mentales interactivos y permiten crear flashcards o preguntas de test desde el propio contenido.
3. **Respaldo Portable e Inmediato:** Exportación e importación completa en formato `.json` (retrocompatible con backups anteriores v1–v5) para mover o respaldar tu espacio de estudio en cualquier momento.
4. **Arquitectura Desacoplada:** Persistencia abstraída tras `StudyRepository` (`InjectionToken`), preparada para tests aislados en memoria y para una futura sincronización opcional en la nube sin tocar la UI.

---

## ✨ Funcionalidades Principales

- **📚 Bloques / Asignaturas Dinámicas:** Crea, personaliza (color e icono), reordena mediante drag-and-drop y gestiona tantos bloques y temas como necesites.
- **✍️ Editor de Apuntes Enriquecido (TipTap):** Formato completo, tablas, listas de tareas, atajos Markdown, exportación a Markdown/PDF e importación local de archivos `.docx` (Mammoth.js) y `.md`.
- **🧠 Mapas Mentales Automáticos (Markmap):** Generación interactiva de esquemas a partir de la estructura de encabezados y listas de tus apuntes, con soporte para esquemas personalizados.
- **🔎 Búsqueda Global Instantánea (MiniSearch):** Búsqueda _full-text_ en cliente sobre títulos, etiquetas y contenido de todos tus temas.
- **📅 Planificador, Kanban y Pomodoro:** Tablero Kanban de progreso por vueltas, mapa de calor (_heatmap_) de temas que necesitan repaso, planificador semanal y temporizador Pomodoro persistente con registro automático de sesiones.
- **📝 Motor de Tests y Simulacros:** Banco de preguntas, importación local desde PDF (`pdfjs-dist`), generador de preguntas desde apuntes, supuestos prácticos, penalizaciones configurables (`0`, `-1/4`, `-1/3`, `-1/2`) y analíticas de rendimiento.
- **🃏 Flashcards con Repaso Espaciado (SM-2) y Gamificación:** Algoritmo SM-2 para optimizar la retención, misiones diarias, rachas de estudio y mapa de progreso.
- **🧭 Guía Interactiva Integrada:** Onboarding y guía de uso navegable dentro de la propia aplicación (`/guide`).
- **🌗 Tema Claro / Oscuro y PWA Instalable:** Interfaz responsive adaptable a escritorio, tablet y móvil, instalable como aplicación offline.

---

## 🛠️ Stack Tecnológico

| Capa                          | Tecnología                                                                                                                                                                                    |
| :---------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**                 | [Angular 22](https://angular.dev/) (Standalone Components, Signals, `@if`/`@for`, `inject()`)                                                                                                 |
| **Estilos & UI**              | [Tailwind CSS v4](https://tailwindcss.com/) + [Angular Material](https://material.angular.io/) + [Angular CDK](https://material.angular.io/cdk/categories)                                    |
| **Persistencia Local**        | [Dexie.js](https://dexie.org/) sobre IndexedDB + `navigator.storage.persist()`                                                                                                                |
| **Editor & Documentos**       | [TipTap](https://tiptap.dev/) (ProseMirror), [Mammoth.js](https://github.com/mwilliamson/mammoth.js) (`.docx`), [Marked](https://marked.js.org/), [PDF.js](https://mozilla.github.io/pdf.js/) |
| **Mapas Mentales & Búsqueda** | [Markmap](https://markmap.js.org/) (`markmap-lib` + `markmap-view`), [MiniSearch](https://lucaong.github.io/minisearch/)                                                                      |
| **Offline / PWA**             | `@angular/service-worker` + Web App Manifest                                                                                                                                                  |
| **Testing & Calidad**         | [Vitest 5](https://vitest.dev/) + jsdom + Prettier + GitHub Actions CI                                                                                                                        |

---

## 🏛️ Arquitectura y Decisiones Técnicas

El proyecto sigue una arquitectura **Clean Client-Side** orientada a funcionalidades:

- **UI sin acoplamiento a IndexedDB:** Los componentes solo interactúan con `StudyStoreService` (Signals reactivos) y nunca importan Dexie directamente (regla verificada automáticamente en CI).
- **Patrón Repositorio:** `STUDY_REPOSITORY` desacopla el almacenamiento real (`IndexedDbStudyRepository`) de los mocks en memoria usados en pruebas unitarias (`MockStudyRepository`).
- **Migraciones seguras:** Esquema versionado en Dexie y `BackupService` retrocompatible con versiones `v1`–`v5`.

Para diagramas y detalles técnicos completos, consulta [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

---

## 🏁 Inicio Rápido

### Requisitos previos

- **Node.js:** `>= 20.x` (recomendado `24.x`, usado en CI)
- **npm:** `>= 10.x`

### Instalación y desarrollo

```bash
# Clonar el repositorio
git clone https://github.com/csanzfer/study.git
cd study

# Instalar dependencias
npm install

# Iniciar el servidor de desarrollo
npm start
```

Abre `http://localhost:4200/` en tu navegador. La aplicación se recarga automáticamente ante cualquier cambio.

---

## 🧪 Pruebas y Compilación

### Pruebas Unitarias (Vitest)

```bash
# Modo interactivo / vigilancia
npm test

# Ejecución única (CI)
CI=true NG_CLI_ANALYTICS=false npx ng test --watch=false
```

### Compilación

```bash
# Producción (incluye Service Worker PWA)
npm run build
```

Los artefactos compilados se generan en `dist/tai-study/browser`.

> [!NOTE]
> En entornos aislados o sin acceso a internet, puedes omitir la optimización de fuentes externas compilando en modo desarrollo:
>
> ```bash
> CI=true NG_CLI_ANALYTICS=false npx ng build --configuration development
> ```

---

## 📁 Estructura del Proyecto

```text
study/
├── public/                       # Iconos PWA y Web App Manifest
├── src/
│   ├── app/
│   │   ├── core/                 # Base de datos Dexie, Modelos, Repositorios y Servicios (Store, Backup, Theme, Pomodoro)
│   │   ├── shared/               # AppShell, diálogos compartidos y utilidades puras (TipTap, SRS, Markdown)
│   │   ├── features/
│   │   │   ├── dashboard/        # Panel principal, progreso por bloques y banner de bienvenida
│   │   │   ├── block-view/       # Lista de temas por bloque, reordenación y exportación
│   │   │   ├── notes/            # Editor TipTap, detalle de tema, importación Word/MD y exportación
│   │   │   ├── schemas/          # Visor interactivo de mapas mentales con Markmap
│   │   │   ├── planner/          # Kanban de vueltas, heatmap, planificador semanal y Pomodoro
│   │   │   ├── tests/            # Banco de preguntas, importación PDF, supuestos prácticos y simulacros
│   │   │   ├── flashcards/       # Repaso espaciado SM-2, mazos, misiones y gamificación
│   │   │   └── guide/            # Guía interactiva de uso integrada en la app
│   │   ├── app.config.ts         # Proveedores globales (Routing, PWA, Material, Repositorio)
│   │   ├── app.routes.ts         # Rutas con lazy-loading
│   │   └── app.ts                # Componente raíz
│   ├── styles.scss               # Estilos globales y tema Material
│   └── tailwind.css              # Configuración de Tailwind CSS v4
├── docs/                         # Documentación de arquitectura, contexto y hojas de ruta
├── AGENTS.md                     # Directrices técnicas y convenciones para agentes de IA
├── CONTRIBUTING.md               # Guía de contribución y flujo Git
└── LICENSE                       # Licencia MIT
```

---

## 🔒 Privacidad y Copias de Seguridad

- **100% Privado:** Tus apuntes, preguntas, flashcards y métricas nunca salen de tu navegador.
- **Almacenamiento Persistente:** La app solicita `navigator.storage.persist()` para reducir el riesgo de limpieza automática del navegador.
- **Copias JSON Portables:** Puedes exportar e importar toda tu base de datos en un único archivo `.json` desde la barra superior en cualquier momento.

---

## 📚 Documentación Adicional

- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — Arquitectura de software, flujo de datos y patrones de diseño.
- [docs/PLAN_CRISISSTUDENT.md](./docs/PLAN_CRISISSTUDENT.md) — Evolución hacia una plataforma de estudio genérica y multi-materia.
- [docs/PLAN.md](./docs/PLAN.md) — Plan histórico de análisis funcional y fases originales (Fases 0–4).
- [docs/CONTEXT.md](./docs/CONTEXT.md) — Contexto de origen del proyecto y decisiones de producto.
- [CHANGELOG.md](./CHANGELOG.md) — Historial de versiones y novedades.
- [CONTRIBUTING.md](./CONTRIBUTING.md) — Estándares de código, convenciones de commits y checklist de PR.
- [AGENTS.md](./AGENTS.md) — Reglas y convenciones técnicas para asistentes de IA.

---

## 📄 Licencia

Este proyecto se distribuye bajo la licencia **MIT**. Consulta el archivo [LICENSE](./LICENSE) para más detalles.
