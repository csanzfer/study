# Changelog

Todos los cambios notables de **CrisIsStudent** se documentan en este archivo.
El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto sigue [Semantic Versioning](https://semver.org/lang/es/).

## [2.0.0] - 2026-11-25

### Añadido

- **Plataforma multi-materia (`CrisIsStudent`):** CRUD completo de bloques/asignaturas dinámicas con paleta de colores, iconos Material, reordenación y borrado en cascada seguro en Dexie.
- **Guía interactiva integrada (`/guide`):** Manual navegable dentro de la aplicación y banner de bienvenida/onboarding en el Dashboard.
- **Backup v5 retrocompatible:** Exportación bajo `appName: 'crisisstudent'` manteniendo compatibilidad total con copias anteriores (`v1`–`v4` de `tai-study`).

### Cambiado

- Identidad visual actualizada a paleta cian (`#0891b2`) junto con nuevos iconos PWA (`192x192`, `512x512` y `apple-touch-icon`).
- Generalización de tests, flashcards, etiquetas sugeridas, importadores y gamificación para cualquier disciplina de estudio.

## [1.0.0] - 2026-11-24

### Añadido

- **Arquitectura Local-First & PWA:** Angular 22 (Standalone + Signals), Tailwind CSS v4, Angular Material/CDK, IndexedDB con Dexie.js, `StudyRepository` desacoplado, tema claro/oscuro y backup portable JSON.
- **Apuntes y Esquemas (Fase 1):** Editor enriquecido TipTap, importación local `.docx` (Mammoth.js) y Markdown, exportación Markdown/PDF, mapas mentales interactivos con Markmap y búsqueda global _full-text_ con MiniSearch.
- **Planificación y Enfoque (Fase 2):** Tablero Kanban de vueltas, mapa de calor (_heatmap_) de temas oxidados, planificador semanal y temporizador Pomodoro persistente con registro de sesiones.
- **Motor de Tests y Simulacros (Fase 3):** Banco de preguntas, importación local desde PDF (`pdfjs-dist`), generador de preguntas desde apuntes, supuestos prácticos, penalizaciones configurables y analíticas.
- **Flashcards SRS y Gamificación (Fase 4):** Repaso espaciado con algoritmo SM-2, importación de tarjetas, misiones diarias, rachas y mapa de progreso.
