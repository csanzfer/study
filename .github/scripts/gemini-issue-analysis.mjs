import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const COMMENT_MARKER = '<!-- tai-study-issue-analysis -->';
const MAX_CONTEXT_CHARS = 100_000;
const MAX_SINGLE_FILE_CHARS = 14_000;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

const cliArgs = process.argv.slice(2);
const dryRun = cliArgs.includes('--dry-run');
const positionalArgs = cliArgs.filter((arg) => !arg.startsWith('--'));

const apiKey = process.env.GEMINI_API_KEY?.trim();
if (!apiKey) {
  console.log(
    '::notice::GEMINI_API_KEY no está configurado. Se omite el análisis automático de la issue.',
  );
  process.exit(0);
}

const githubToken = process.env.GITHUB_TOKEN?.trim();
const repo = process.env.GITHUB_REPOSITORY?.trim();
const issueNumber = process.env.ISSUE_NUMBER?.trim() || positionalArgs[0]?.trim();
const model =
  process.env.GEMINI_ISSUE_MODEL?.trim() ||
  process.env.GEMINI_MODEL?.trim() ||
  'gemini-3.8-pro';

if (!issueNumber || !/^\d+$/.test(issueNumber)) {
  console.error(
    'Falta el número de issue (variable ISSUE_NUMBER o argumento posicional: node .github/scripts/gemini-issue-analysis.mjs <numero> [--dry-run]).',
  );
  process.exit(1);
}

if (!githubToken || !repo) {
  console.error('Faltan variables de entorno de GitHub (GITHUB_TOKEN o GITHUB_REPOSITORY).');
  process.exit(1);
}

const githubHeaders = {
  Authorization: `Bearer ${githubToken}`,
  Accept: 'application/vnd.github+json',
  'Content-Type': 'application/json',
  'X-GitHub-Api-Version': '2022-11-28',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readTruncated(filePath, maxChars = MAX_SINGLE_FILE_CHARS) {
  if (!existsSync(filePath)) return '';
  const content = readFileSync(filePath, 'utf8');
  if (content.length <= maxChars) return content;
  return `${content.slice(0, maxChars)}\n\n... [Archivo truncado a ${maxChars} caracteres]`;
}

function walkFiles(dir, result = []) {
  if (!existsSync(dir)) return result;
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walkFiles(fullPath, result);
    } else {
      result.push(relative(process.cwd(), fullPath).replaceAll('\\', '/'));
    }
  }
  return result;
}

function extractKeywords(text) {
  const stopWords = new Set([
    'para', 'como', 'esto', 'esta', 'este', 'desde', 'sobre', 'entre', 'donde',
    'cuando', 'tiene', 'debe', 'hacer', 'añadir', 'crear', 'poder', 'issue',
    'with', 'from', 'that', 'this', 'have', 'should', 'feature', 'enhancement',
    'tema', 'temas', 'bloque', 'bloques', 'estudio', 'study',
  ]);

  const rawTokens = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !stopWords.has(token));

  return [...new Set(rawTokens)];
}

function selectRelevantFeatureFiles(allAppFiles, issueText, alreadyIncluded, remainingBudget) {
  const keywords = extractKeywords(issueText);
  if (keywords.length === 0 || remainingBudget <= 1_000) return [];

  const candidates = allAppFiles
    .filter(
      (filePath) =>
        !alreadyIncluded.has(filePath) &&
        !filePath.endsWith('.spec.ts') &&
        (filePath.startsWith('src/app/features/') || filePath.startsWith('src/app/shared/')),
    )
    .map((filePath) => {
      const normalizedPath = filePath.toLowerCase();
      let score = 0;
      for (const kw of keywords) {
        if (normalizedPath.includes(kw)) score += 3;
      }
      return { filePath, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.filePath.localeCompare(b.filePath));

  const selected = [];
  let used = 0;

  for (const { filePath } of candidates) {
    if (selected.length >= 8) break;
    const content = readTruncated(filePath, 8_000);
    if (!content) continue;
    if (used + content.length > remainingBudget) continue;
    selected.push({ filePath, content });
    used += content.length;
  }

  return selected;
}

function buildRepoContext(issueText) {
  const allAppFiles = walkFiles('src/app').sort();
  const sections = [];
  let totalChars = 0;

  const pushSection = (title, content) => {
    if (!content) return;
    const block = `### ${title}\n${content}`;
    if (totalChars + block.length > MAX_CONTEXT_CHARS) return;
    sections.push(block);
    totalChars += block.length;
  };

  pushSection('Directrices del repositorio (AGENTS.md)', readTruncated('AGENTS.md', 10_000));
  pushSection('Arquitectura (ARCHITECTURE.md)', readTruncated('ARCHITECTURE.md', 10_000));
  pushSection('Árbol de archivos en src/app/', `\`\`\`text\n${allAppFiles.join('\n')}\n\`\`\``);

  const coreFiles = [
    'src/app/app.routes.ts',
    'src/app/core/models/study.models.ts',
    'src/app/core/db/study.db.ts',
    'src/app/core/repositories/study.repository.ts',
    'src/app/core/services/study-store.service.ts',
    'src/app/core/services/backup.service.ts',
  ];

  const included = new Set();
  for (const filePath of coreFiles) {
    const content = readTruncated(filePath, 10_000);
    if (content) {
      included.add(filePath);
      pushSection(`Archivo core: \`${filePath}\``, `\`\`\`ts\n${content}\n\`\`\``);
    }
  }

  const remainingBudget = MAX_CONTEXT_CHARS - totalChars;
  const matchedFiles = selectRelevantFeatureFiles(
    allAppFiles,
    issueText,
    included,
    remainingBudget,
  );

  for (const { filePath, content } of matchedFiles) {
    const lang = filePath.endsWith('.html') ? 'html' : filePath.endsWith('.scss') ? 'scss' : 'ts';
    pushSection(`Archivo relacionado: \`${filePath}\``, `\`\`\`${lang}\n${content}\n\`\`\``);
  }

  return {
    contextMarkdown: sections.join('\n\n'),
    matchedFilePaths: matchedFiles.map((f) => f.filePath),
  };
}

async function fetchIssueAndComments() {
  const issueUrl = `https://api.github.com/repos/${repo}/issues/${issueNumber}`;
  const issueRes = await fetch(issueUrl, { headers: githubHeaders });
  if (!issueRes.ok) {
    throw new Error(`No se pudo leer la issue #${issueNumber} (${issueRes.status}): ${await issueRes.text()}`);
  }
  const issue = await issueRes.json();

  if (issue.pull_request) {
    console.log(`#${issueNumber} es una Pull Request, no una issue. Se omite el análisis.`);
    process.exit(0);
  }

  const commentsUrl = `https://api.github.com/repos/${repo}/issues/${issueNumber}/comments?per_page=100`;
  const commentsRes = await fetch(commentsUrl, { headers: githubHeaders });
  if (!commentsRes.ok) {
    throw new Error(`No se pudieron leer los comentarios de la issue #${issueNumber} (${commentsRes.status})`);
  }
  const comments = await commentsRes.json();

  const existingAnalysis = comments.find(
    (comment) => typeof comment.body === 'string' && comment.body.includes(COMMENT_MARKER),
  );

  const relevantComments = comments
    .filter(
      (comment) =>
        typeof comment.body === 'string' &&
        !comment.body.includes(COMMENT_MARKER) &&
        !comment.body.trim().startsWith('/analyze'),
    )
    .slice(-10)
    .map((comment) => `- **@${comment.user?.login ?? 'usuario'}**: ${comment.body.trim()}`)
    .join('\n');

  return { issue, existingAnalysis, relevantComments };
}

async function callGemini(prompt) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? '')
        .join('')
        .trim();

      if (!text) {
        throw new Error(`Respuesta vacía de Gemini API: ${JSON.stringify(data)}`);
      }

      return text;
    }

    const errorBody = await response.text();
    if (RETRYABLE_STATUSES.has(response.status)) {
      if (attempt < MAX_ATTEMPTS) {
        const delayMs = attempt * 10_000;
        console.log(
          `::warning::Gemini API devolvió ${response.status} (intento ${attempt}/${MAX_ATTEMPTS}). Reintentando en ${delayMs / 1000}s...`,
        );
        await sleep(delayMs);
        continue;
      }

      const transientError = new Error(
        `Gemini API temporalmente no disponible (${response.status}): ${errorBody}`,
      );
      transientError.isTransient = true;
      throw transientError;
    }

    throw new Error(`Gemini API devolvió ${response.status}: ${errorBody}`);
  }
}

async function upsertIssueComment(existingAnalysis, body) {
  const targetUrl = existingAnalysis
    ? `https://api.github.com/repos/${repo}/issues/comments/${existingAnalysis.id}`
    : `https://api.github.com/repos/${repo}/issues/${issueNumber}/comments`;

  const saveRes = await fetch(targetUrl, {
    method: existingAnalysis ? 'PATCH' : 'POST',
    headers: githubHeaders,
    body: JSON.stringify({ body }),
  });

  if (!saveRes.ok) {
    const errText = await saveRes.text();
    throw new Error(`Error publicando comentario en GitHub (${saveRes.status}): ${errText}`);
  }

  console.log(
    existingAnalysis
      ? `Análisis actualizado en el comentario #${existingAnalysis.id}.`
      : `Análisis publicado en la issue #${issueNumber}.`,
  );
}

try {
  const { issue, existingAnalysis, relevantComments } = await fetchIssueAndComments();
  const labels = (issue.labels ?? [])
    .map((label) => (typeof label === 'string' ? label : label.name))
    .filter(Boolean);

  const issueTextForMatching = [issue.title ?? '', issue.body ?? '', labels.join(' '), relevantComments].join('\n');
  const { contextMarkdown, matchedFilePaths } = buildRepoContext(issueTextForMatching);

  const prompt = `Eres un arquitecto de software senior experto en Angular 22, TypeScript y aplicaciones local-first (Dexie.js / IndexedDB) trabajando en **TAI Study**.

Tu objetivo es analizar la siguiente issue de GitHub y redactar un **plan técnico de implementación completo, preciso y autocontenido en español**, de modo que posteriormente otro desarrollador o un modelo de IA más ligero pueda implementarlo paso a paso sin ambigüedades ni errores arquitectónicos.

## Issue a analizar
- **Número:** #${issue.number}
- **Título:** ${issue.title ?? '(Sin título)'}
- **Etiquetas:** ${labels.length > 0 ? labels.join(', ') : '(Sin etiquetas)'}
- **Descripción:**
${issue.body?.trim() || '(Sin descripción)'}

${relevantComments ? `## Comentarios previos relevantes\n${relevantComments}\n` : ''}
## Contexto real del repositorio
${contextMarkdown}

## Instrucciones de salida
Responde **únicamente** con el Markdown del análisis (sin bloque de código envolvente externo) siguiendo estrictamente esta estructura:

### 1. Resumen y alcance
- **Objetivo:** 2-3 líneas claras.
- **Dentro de alcance:** lista concreta.
- **Fuera de alcance:** qué no debe tocarse.

### 2. Impacto en modelo de datos, Dexie y Backup
Si no requiere cambios en datos, indícalo explícitamente ("Sin cambios en modelo de datos, Dexie ni Backup"). Si requiere cambios, detalla:
- **Modelos (\`src/app/core/models/study.models.ts\`):** interfaces/campos exactos.
- **Base de datos (\`src/app/core/db/study.db.ts\`):** versión de Dexie, índices y migración si aplica.
- **Repositorio (\`src/app/core/repositories/study.repository.ts\`):** métodos en \`StudyRepository\` e \`IndexedDbStudyRepository\`.
- **Store (\`src/app/core/services/study-store.service.ts\`):** signals, \`computed()\` y métodos públicos.
- **Backup (\`src/app/core/services/backup.service.ts\`):** exportación/importación retrocompatible.

### 3. Archivos a crear o modificar
Tabla Markdown con columnas: \`Archivo | Acción | Cambios clave\`. Usa exclusivamente rutas reales del árbol de archivos del repositorio (o rutas nuevas coherentes con la arquitectura).

### 4. Plan de implementación paso a paso
Lista numerada de pasos atómicos y ordenados (primero datos/utilidades, luego store, luego UI, luego rutas/integración). Incluye nombres concretos de signals, métodos o componentes.

### 5. Casos límite (edge cases) y restricciones de \`AGENTS.md\`
Lista de edge cases reales (estados vacíos, datos legacy en IndexedDB/backup, async/concurrencia, validaciones, tema oscuro \`dark:\`) y reglas aplicables de \`AGENTS.md\` (standalone, \`inject()\`, \`@if\`/\`@for\`, sin \`HttpClient\`, sin importar \`dexie\` fuera de \`core/db/\`).

### 6. Plan de tests y verificación
- Archivos \`*.spec.ts\` a crear o ampliar y escenarios concretos a cubrir (siempre con mock de \`STUDY_REPOSITORY\`, nunca IndexedDB real).
- Comandos de verificación exactos de \`AGENTS.md\`:
  \`\`\`bash
  CI=true NG_CLI_ANALYTICS=false HOME=/tmp npx ng test --watch=false
  CI=true NG_CLI_ANALYTICS=false HOME=/tmp npx ng build --configuration development
  \`\`\`

### 7. Preguntas abiertas / Ambigüedades
Si la issue está clara, indica "Ninguna". Si falta alguna definición funcional, enumera las preguntas con una opción recomendada por defecto.

No inventes archivos que no existen como si existieran, no repitas el enunciado literalmente y sé conciso pero completo.`;

  const analysisMarkdown = await callGemini(prompt);
  const inspectedNote =
    matchedFilePaths.length > 0
      ? `\n\n<details>\n<summary>Archivos de features/shared inspeccionados automáticamente (${matchedFilePaths.length})</summary>\n\n${matchedFilePaths.map((p) => `- \`${p}\``).join('\n')}\n</details>`
      : '';

  const finalComment = [
    COMMENT_MARKER,
    `## 🧭 Análisis técnico y plan de implementación (\`${model}\`)`,
    `_Generado automáticamente para facilitar la implementación con un modelo más ligero. Puedes re-ejecutarlo comentando \`/analyze\`._`,
    '',
    analysisMarkdown + inspectedNote,
  ].join('\n');

  if (dryRun) {
    console.log(finalComment);
    process.exit(0);
  }

  await upsertIssueComment(existingAnalysis, finalComment);
} catch (error) {
  if (error?.isTransient) {
    console.log(
      `::warning::Se omitió el análisis automático por indisponibilidad temporal de Gemini: ${error.message}`,
    );
    process.exit(0);
  }
  console.error('Error durante el análisis de la issue con Gemini:', error);
  process.exit(1);
}
