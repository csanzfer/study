# CONTRIBUTING.md — Guía de Contribución al Proyecto

¡Gracias por tu interés en contribuir a **CrisIsStudent**! Esta guía establece los estándares de desarrollo, flujos de trabajo en Git y convenciones de código para mantener la calidad y consistencia del proyecto.

---

## 🚀 1. Configuración del Entorno de Desarrollo

### Requisitos

- **Node.js:** Versión 20.x o superior.
- **npm:** Versión 10.x o superior.
- **Git** configurado en tu equipo.

### Pasos Iniciales

1. Clona el repositorio:
   ```bash
   git clone https://github.com/csanzfer/study.git
   cd study
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Inicia el servidor de desarrollo:
   ```bash
   npm start
   ```
4. Abre `http://localhost:4200` en tu navegador.

---

## 🌿 2. Flujo de Trabajo en Git

### Ramas

- `main`: Rama de código de producción, estable y siempre funcional.
- `feat/<nombre-de-la-funcionalidad>`: Para nuevas funcionalidades (ej. `feat/phase-1-tiptap-editor`).
- `fix/<nombre-del-bug>`: Para correcciones de errores (ej. `fix/indexeddb-reordering-bug`).
- `docs/<nombre-de-la-mejora>`: Para cambios en documentación.

### Convención de Commits (Conventional Commits)

Los mensajes de commit deben seguir el estándar de [Conventional Commits](https://www.conventionalcommits.org/):

```text
<tipo>(<ámbito opcional>): <descripción concisa en minúsculas y presente>

[cuerpo explicativo opcional]

[referencias a issues opcionales]
```

**Tipos válidos:**

- `feat`: Nueva característica para el usuario.
- `fix`: Corrección de un fallo.
- `docs`: Modificaciones únicamente en archivos de documentación (`*.md`).
- `style`: Formato, puntos y comas, espacios (sin cambio de código ejecutable).
- `refactor`: Refactorización de código sin añadir funcionalidad ni corregir bugs.
- `test`: Añadir o modificar pruebas unitarias.
- `chore`: Tareas de mantenimiento de configuración, scripts de npm, dependencias, etc.

_Ejemplo:_

```bash
git commit -m "feat(notes): integrate tiptap markdown shortcuts and exam callout"
```

---

## 📐 3. Estándares y Convenciones de Código

### TypeScript y Angular

- **Componentes Standalone Obligatorios:** Prohibido el uso de `NgModule`. Todo componente, directiva o pipe es independiente.
- **Reactividad con Signals:** Usa Signals (`signal`, `computed`, `effect`) para el estado. Evita crear nuevos `BehaviorSubject` o suscripciones manuales de RxJS si un Signal resuelve el problema de forma más limpia.
- **Inyección con `inject()`:** Declara dependencias usando `inject(MiServicio)` a nivel de propiedad.
- **Control Flow Moderno:** Usa `@if`, `@else`, `@for (item of items; track item.id)` y `@switch`.
- **Tipado Estricto:** Evita el uso de `any`. Define interfaces o tipos explícitos en `src/app/core/models/`.

### Estilos y CSS

- Emplea **Tailwind CSS v4** mediante clases utilitarias semánticas.
- Mantén compatibilidad con el **modo oscuro** (`dark:...`).
- Si requieres reglas SCSS personalizadas, agrégalas en el archivo `.scss` propio del componente o en `src/styles.scss` si son globales.

---

## 🧪 4. Pruebas Unitarias

Toda nueva funcionalidad o corrección en la capa de servicios, repositorios o stores debe acompañarse de sus pruebas unitarias correspondientes:

```bash
# Ejecutar todas las pruebas unitarias:
CI=true NG_CLI_ANALYTICS=false HOME=/tmp npx ng test --watch=false
```

- Las pruebas deben ubicarse junto al archivo probado bajo el formato `nombre.spec.ts`.
- Usa siempre el patrón `MockStudyRepository` para aislar las pruebas de la base de datos real.

---

## ✅ 5. Lista de Verificación antes de Enviar Cambios (PR Checklist)

Antes de hacer commit y solicitar revisión de tus cambios, comprueba que:

- [ ] Todas las pruebas unitarias pasan sin errores (`npm test` o comando CI).
- [ ] El proyecto compila sin errores (`npx ng build --configuration development`).
- [ ] El formato de código respeta Prettier (`npx prettier --check .`).
- [ ] No se han dejado `console.log()` huérfanos o código comentado no justificado.
- [ ] Si se han modificado estructuras de datos, se ha actualizado la documentación en `docs/CONTEXT.md` y `docs/ARCHITECTURE.md`.
