# CONTEXT.md — Contexto de Dominio y Producto: TAI Study

Este documento reúne todo el contexto de negocio, el marco opositor oficial de la Administración Pública española, las necesidades pedagógicas del usuario y las decisiones de producto que rigen el desarrollo de **TAI Study**.

---

## 🏛️ 1. ¿Qué son las Oposiciones TAI?

El cuerpo de **Técnicos Auxiliares de Informática (TAI)** pertenece al Subgrupo **C1** de la **Administración General del Estado (AGE)** de España. Su convocatoria y gestión depende del Instituto Nacional de Administración Pública (**INAP**).

Los profesionales de este cuerpo realizan tareas de apoyo y desarrollo informático en ministerios, agencias estatales, la Agencia Tributaria, la Seguridad Social y otras entidades públicas.

### Estructura Oficial del Programa de Oposición

El temario oficial se divide de forma estricta en **4 Bloques temáticos**:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        TEMARIO OFICIAL TAI (AGE)                       │
├────────────────────────────────┬───────────────────────────────────────┤
│ Bloque I:                      │ Bloque II:                            │
│ Organización del Estado y      │ Tecnología Básica                     │
│ Administración Electrónica     │ - Hardware y periféricos              │
│ - Constitución Española de 1978│ - Arquitectura de computadores        │
│ - Ley 39/2015 (LPACAP)         │ - Sistemas operativos (Linux/Windows) │
│ - Ley 40/2015 (LRJSP)          │ - Protocolos TCP/IP y Modelo OSI      │
│ - Esquema Nacional de Seguridad│ - Redes de datos y seguridad básica   │
│ - RGPD y LOPDGDD               │ - Almacenamiento y memorias           │
├────────────────────────────────┼───────────────────────────────────────┤
│ Bloque III:                    │ Bloque IV:                            │
│ Desarrollo de Sistemas         │ Sistemas y Comunicaciones             │
│ - Ciclo de vida del software   │ - Administración de servidores        │
│ - Modelos y metodologías (Agile│ - Virtualización y Cloud (IaaS/PaaS)  │
│ - Bases de datos SQL y NoSQL   │ - Infraestructura de comunicaciones   │
│ - Programación web y APIs REST │ - Seguridad perimetral y firewalls    │
│ - Accesibilidad y estándares   │ - Copias de seguridad y contingencia  │
└────────────────────────────────┴───────────────────────────────────────┘
```

---

## 🎯 2. El Problema del Opositor y Propósito de la App

### La Fricción Habitual

1. **Material disperso:** El opositor adquiere temarios de academias (en papel físico, PDF o Word).
2. **Doble trabajo agotador:** Pasar apuntes a limpio, luego hacer a mano esquemas o resúmenes, y luego volver a teclear preguntas o tarjetas Anki.
3. **Pérdida de control del avance:** Es difícil cuantificar las "vueltas" reales dadas a cada tema, saber qué temas están "oxidados" (mucho tiempo sin repaso) y qué temas están dominados.
4. **Exámenes con penalización:** En el examen oficial del INAP, las preguntas contestadas erróneamente penalizan habitualmente **1/3** del valor de un acierto ($-\frac{1}{3}$). Las preguntas en blanco no penalizan. Es vital entrenar esta estrategia de gestión del riesgo.

### La Solución: TAI Study

TAI Study unifica todo el ciclo de estudio en un entorno digital fluido, sin distracciones y completamente privado:

```text
1. CAPTURA Y REDACCIÓN  ──►  2. ESQUEMATIZACIÓN  ──►  3. PLANIFICACIÓN  ──►  4. ENTRENAMIENTO
   - Editor TipTap           - Generación Markmap     - Vueltas (Kanban)    - Tests oficiales (-1/3)
   - Importación Word .docx    automática desde       - Mapa de salud       - Repaso de fallos
   - Callout "Ojo examen"      encabezados H1-H4      - Temporizador        - Flashcards espaciadas (SRS)
                               y listas de apuntes      Pomodoro              con algoritmo SM-2
```

---

## 💡 3. Principios Fundamentales del Producto

### 1. Filosofía "Local-First" Real

- Los opositores estudian con frecuencia en bibliotecas, transportes públicos o zonas con conexión inestable o restringida.
- La privacidad es primordial: nadie debe monitorizar las notas ni el ritmo de estudio del opositor.
- Todos los datos residen en **IndexedDB** del navegador mediante **Dexie.js**.
- No existe login forzado ni suscripción obligatoria a servidores remotos.
- El usuario puede descargar una copia de seguridad íntegra en `.json` en cualquier instante y restaurarla en otro equipo con un clic.

### 2. Estados de un Tema (Ciclo de Vida)

El progreso de un tema refleja las fases pedagógicas de preparación de una oposición:

| Estado            | Código        | Significado                                                                 |
| :---------------- | :------------ | :-------------------------------------------------------------------------- |
| **Sin empezar**   | `pending`     | Tema virgen en el temario.                                                  |
| **1ª Vuelta**     | `first_round` | Lectura comprensiva, estructuración y asimilación inicial de conceptos.     |
| **Esquematizado** | `outlined`    | Apunte completo y esquema mental revisado y comprendido.                    |
| **Memorizando**   | `memorizing`  | Fase intensiva de retención de plazos, leyes, comandos y detalles técnicos. |
| **Dominado**      | `mastered`    | Tema afianzado con aciertos continuos en tests y repasos al día.            |

---

## 🗺️ 4. Hoja de Ruta y Estado de Implementación

### Fase 0 — Setup y Base Arquitectónica ✅ [COMPLETADA]

- [x] Configuración inicial de Angular 22, Tailwind CSS v4 y Angular Material.
- [x] PWA configurada (`@angular/service-worker`, manifest y modo offline).
- [x] Base de datos IndexedDB con Dexie (`StudyDatabase`) y precarga automática de los 4 Bloques oficiales de TAI.
- [x] Layout responsive con barra lateral, cambio de tema oscuro/claro y botón de exportar/importar backup `.json`.
- [x] Suite de tests unitarios iniciales funcionando con Vitest.

### Fase 1 — Apuntes, Importación Word y Esquemas Automáticos 🔄 [EN DESARROLLO]

- [x] Modelo de datos completo de `Topic` y `TaiBlock`.
- [x] Vista de bloque con listado de temas y reordenación (drag & drop o reindexación).
- [x] Vista de detalle de tema (`topic-detail`) con edición de metadatos, tags y cambio de estado.
- [ ] Integración del editor enriquecido **TipTap** con soporte para tablas, código y bloque destacado _"Ojo examen"_.
- [ ] Importador de archivos `.docx` con **mammoth.js** en cliente.
- [ ] Visor de mapas mentales interactivos con **Markmap** generado desde el contenido estructurado.
- [ ] Búsqueda global instantánea con **MiniSearch**.

### Fase 2 — Tableros de Estudio y Planificación ⏳ [PLANIFICADA]

- [ ] Tablero Kanban de vueltas (`Sin empezar` → `1ª Vuelta` → `Esquematizado` → `Memorizando` → `Dominado`).
- [ ] Mapa de salud del temario (Heatmap según días transcurridos desde `lastReviewedAt`).
- [ ] Planificador semanal y temporizador Pomodoro ligado al tema activo.

### Fase 3 — Motor de Tests y Simulacros TAI ⏳ [PLANIFICADA]

- [ ] Banco de preguntas categorizadas por bloque y tema.
- [ ] Modo de práctica con retroalimentación inmediata, referencias normativas y explicaciones.
- [ ] Simulacro oficial de examen con cronómetro, opción en blanco y penalización configurable (`-1/3`).
- [ ] Banco de supuestos prácticos (para Bloques III y IV) y test específico de preguntas falladas.

### Fase 4 — Flashcards (SRS) y Gamificación ⏳ [PLANIFICADA]

- [ ] Algoritmo de repetición espaciada **SM-2** con intervalos de repaso automático.
- [ ] Creación rápida de flashcards seleccionando texto dentro de un apunte en TipTap.
- [ ] Misiones diarias autogeneradas y sistema de racha flexible con días de descanso.

### Fase 5 — Sincronización Opcional y Exportación Avanzada ⏳ [FUTURO]

- [ ] Implementación de proveedor de repositorio en la nube (`CloudStudyRepository`) para sincronización opcional entre dispositivos.
- [ ] Exportación de temas a PDF imprimible o Markdown limpio.

---

## 📚 5. Glosario de Términos

- **AGE:** Administración General del Estado.
- **INAP:** Instituto Nacional de Administración Pública (organismo selector de las oposiciones TAI).
- **TAI:** Técnicos Auxiliares de Informática (Cuerpo funcionarial perteneciente al subgrupo C1).
- **Vuelta:** Ciclo completo de estudio en el que se repasa la totalidad del temario de inicio a fin.
- **Penalización -1/3:** Fórmula oficial donde cada 3 preguntas contestadas de forma incorrecta descuentan 1 pregunta correcta neta.
- **SRS (Spaced Repetition System):** Sistema de memorización a largo plazo basado en intervalos crecientes de repaso calculados matemáticamente (algoritmo SM-2).
- **Markmap:** Herramienta de visualización de mapas mentales interactivos a partir de texto Markdown estructurado.
- **Mammoth.js:** Librería de JavaScript para convertir archivos `.docx` a HTML semántico respetando títulos y tablas.
