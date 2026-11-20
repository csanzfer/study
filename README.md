# TAI Study — Preparador Local-First para Oposiciones TAI

> Aplicación web **local-first** y **PWA** diseñada específicamente para la preparación de las oposiciones del cuerpo de **Técnicos Auxiliares de Informática (TAI)** de la Administración General del Estado (AGE, España).

![Angular](https://img.shields.io/badge/Angular-22-dd0031?style=flat-square&logo=angular)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue?style=flat-square&logo=typescript)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8?style=flat-square&logo=tailwindcss)
![Dexie.js](https://img.shields.io/badge/Dexie.js-IndexedDB-orange?style=flat-square)
![Vitest](https://img.shields.io/badge/Vitest-5.0-yellow?style=flat-square&logo=vitest)
![PWA](https://img.shields.io/badge/PWA-Ready-success?style=flat-square)

---

## 📖 Descripción General

**TAI Study** está concebido para resolver el principal problema del opositor: la fricción entre tomar apuntes (de libros físicos, temarios oficiales o documentos de Word) y el estudio activo (generación de esquemas mentales, control de vueltas al temario, práctica de tests oficiales con penalización y memorización espaciada con flashcards).

### 💡 Principios Fundamentales

1. **Local-First Real:** Tus datos son 100% tuyos. La aplicación funciona enteramente en el navegador utilizando **IndexedDB (Dexie.js)**. No requiere backend, registros ni conexión a internet continua.
2. **Cero Doble Trabajo:** Al redactar o importar un apunte, la jerarquía de títulos y listas alimenta automáticamente los mapas mentales e interactúa con el generador de flashcards.
3. **Respaldo Portable e Inmediato:** Copias de seguridad completas en formato `.json` descargables e importables en cualquier momento.
4. **Desacoplamiento Arquitectónico:** Capa de datos basada en el patrón Repositorio (`StudyRepository`), lista para soportar sincronización en la nube opcional en el futuro sin modificar la interfaz de usuario.

---

## 🏛️ Los 4 Bloques Oficiales TAI

La app viene preconfigurada con la estructura del programa oficial del INAP:

- **Bloque I:** Organización del Estado y Administración Electrónica (Constitución, Ley 39/2015, Ley 40/2015, ENS, RGPD, transparencia...).
- **Bloque II:** Tecnología Básica (Hardware, sistemas operativos, redes, protocolos TCP/IP, modelos OSI, seguridad física y lógica).
- **Bloque III:** Desarrollo de Sistemas (Ciclo de vida, metodologías ágiles, bases de datos SQL/NoSQL, desarrollo web, accesibilidad, APIs).
- **Bloque IV:** Sistemas y Comunicaciones (Virtualización, cloud computing, administración de servidores Linux/Windows, almacenamiento, infraestructura de redes).

---

## 🚀 Estado del Proyecto y Fases

Para una visión exhaustiva del análisis funcional y técnico, consulta [PLAN.md](file:///Users/csanzfer/workspace/study/PLAN.md) y [CONTEXT.md](file:///Users/csanzfer/workspace/study/CONTEXT.md).

| Fase             | Alcance                                                                                   | Estado               |
| :--------------- | :---------------------------------------------------------------------------------------- | :------------------- |
| **Fase 0**       | Base arquitectónica, Tailwind v4, Material, Dexie DB, PWA, Layout responsive, Backup JSON | ✅ **Completado**    |
| **Fase 1 (MVP)** | CRUD de temas, reordenación, editor TipTap, esquemas automáticos con Markmap, búsqueda    | 🔄 **En desarrollo** |
| **Fase 2**       | Tablero Kanban de vueltas, Heatmap de temas oxidados, planificador semanal, Pomodoro      | ⏳ Planificado       |
| **Fase 3**       | Motor de tests oficiales (penalización `-1/3`), supuestos prácticos, banco de preguntas   | ⏳ Planificado       |
| **Fase 4**       | Flashcards SRS (algoritmo SM-2), misiones diarias, racha flexible y gamificación          | ⏳ Planificado       |
| **Fase 5**       | Sincronización cloud opcional y exportación avanzada a PDF/Markdown                       | ⏳ Futuro            |

---

## 🛠️ Stack Tecnológico

- **Framework:** [Angular 22](https://angular.dev/) (Standalone Components, Signals reactivos, Control Flow `@if`/`@for`, nuevas APIs de inyección).
- **Estilos & UI:** [Tailwind CSS v4](https://tailwindcss.com/) + [Angular Material](https://material.angular.io/) + [Angular CDK](https://material.angular.io/cdk/categories) (`drag-drop` para reordenación y tableros).
- **Almacenamiento Local:** [Dexie.js](https://dexie.org/) (envoltura minimalista y tipada sobre IndexedDB del navegador).
- **Offline / PWA:** `@angular/service-worker` y Web App Manifest integrado.
- **Testing:** [Vitest](https://vitest.dev/) integrado con el test runner de Angular.
- **Futuras integraciones (Fase 1):** TipTap (editor enriquecido ProseMirror), Mammoth.js (conversor `.docx` a HTML semántico local), Markmap (mapas mentales interactivos), MiniSearch (búsqueda full-text en cliente).

---

## 🏁 Inicio Rápido

### Requisitos previos

- **Node.js:** `>= 20.x`
- **npm:** `>= 10.x`

### Instalación

```bash
# Clonar el repositorio
git clone <url-del-repositorio>
cd study

# Instalar dependencias
npm install
```

### Servidor de Desarrollo

Inicia el servidor local de desarrollo:

```bash
npm start
# o bien:
npx ng serve
```

Abre tu navegador en `http://localhost:4200/`. La aplicación se recarga automáticamente ante cualquier cambio de código.

---

## 🧪 Pruebas y Construcción

### Ejecutar Pruebas Unitarias

El proyecto utiliza Vitest mediante el unit test builder de Angular:

```bash
# Modo interactivo / vigilancia:
npm test

# Modo ejecución única (CI):
CI=true NG_CLI_ANALYTICS=false npx ng test --watch=false
```

### Compilar para Producción

```bash
npm run build
```

Los artefactos compilados se almacenan en el directorio `dist/tai-study/browser`.

> [!NOTE]
> En entornos aislados o sin conexión a internet (sandbox/CI offline), la optimización de fuentes web externas de Google Fonts puede omitirse usando:
>
> ```bash
> npx ng build --configuration development
> ```

---

## 📁 Estructura del Proyecto

```text
tai-study/
├── public/                 # Favicon, iconos SVG e información de Web App Manifest
├── src/
│   ├── app/
│   │   ├── core/           # Núcleo: Base de datos, Repositorios, Servicios y Modelos
│   │   │   ├── db/         # Esquema Dexie (StudyDatabase), seed inicial de bloques TAI
│   │   │   ├── models/     # Tipos TypeScript del dominio (TaiBlock, Topic, BackupPayload...)
│   │   │   ├── repositories/ # Interfaces y adaptadores (StudyRepository, IndexedDbStudyRepository)
│   │   │   └── services/   # StudyStoreService (Signals), BackupService, ThemeService
│   │   ├── shared/         # Componentes y utilidades compartidas
│   │   │   └── components/ # AppShell (sidebar + navbar), ConfirmDialog
│   │   ├── features/       # Módulos funcionales de la aplicación
│   │   │   ├── dashboard/  # Panel principal con resumen de avance y métricas
│   │   │   ├── block-view/ # Vista detallada de un bloque, lista de temas y reordenación
│   │   │   ├── notes/      # Editor de apuntes y gestión de tema (topic-detail)
│   │   │   └── coming-soon/# Pantalla para módulos en desarrollo (schemas, planner, tests...)
│   │   ├── app.config.ts   # Proveedores globales de Angular (Routing, PWA, Material, Repo)
│   │   ├── app.routes.ts   # Enrutamiento perezoso (Lazy loading)
│   │   └── app.ts          # Componente raíz con AppShell
│   ├── styles.scss         # Estilos globales y temas Material
│   ├── tailwind.css        # Configuración de Tailwind CSS v4
│   └── main.ts             # Punto de entrada de la aplicación
├── AGENTS.md               # Directrices, arquitectura y reglas para agentes de IA
├── ARCHITECTURE.md         # Documento detallado de diseño y arquitectura del sistema
├── CONTEXT.md              # Contexto de dominio, metodología de estudio y glosario
├── CONTRIBUTING.md         # Guía de contribución para desarrolladores
└── PLAN.md                 # Plan maestro de análisis funcional y fases de desarrollo
```

---

## 🔒 Copias de Seguridad y Privacidad

- **100% Privado:** Los apuntes, notas personales y métricas de estudio nunca se envían a servidores de terceros.
- **Persistencia en navegador:** La aplicación solicita automáticamente `navigator.storage.persist()` para evitar que el navegador limpie la base de datos por falta de espacio en disco.
- **Descargas JSON:** En la barra superior tienes un botón dedicado a la exportación de backup en formato JSON. Se recomienda descargar copias periódicas de tu avance.

---

## 📚 Documentación Adicional

- [AGENTS.md](file:///Users/csanzfer/workspace/study/AGENTS.md) — Guía de estilo y directrices técnicas para asistentes de IA y agentes.
- [ARCHITECTURE.md](file:///Users/csanzfer/workspace/study/ARCHITECTURE.md) — Arquitectura de software, flujo de datos y patrones de diseño.
- [CONTEXT.md](file:///Users/csanzfer/workspace/study/CONTEXT.md) — Contexto del dominio TAI, programa del INAP y decisiones de producto.
- [CONTRIBUTING.md](file:///Users/csanzfer/workspace/study/CONTRIBUTING.md) — Normas de contribución, git workflow y estándares de código.
- [PLAN.md](file:///Users/csanzfer/workspace/study/PLAN.md) — Hoja de ruta funcional completa y backlog por fases.
