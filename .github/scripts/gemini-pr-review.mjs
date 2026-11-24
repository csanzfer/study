import { existsSync, readFileSync } from 'node:fs';
import { generateWithGemini } from './gemini-client.mjs';

const COMMENT_MARKER = '<!-- tai-study-gemini-pr-review -->';
const MAX_DIFF_CHARS = 90_000;

const apiKey = process.env.GEMINI_API_KEY?.trim();
if (!apiKey) {
  console.log(
    '::notice::GEMINI_API_KEY no está configurado en Secrets del repositorio. Se omite la revisión con IA.',
  );
  process.exit(0);
}

const githubToken = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const prNumber = process.env.PR_NUMBER;
const prTitle = process.env.PR_TITLE ?? '';
const prBody = process.env.PR_BODY ?? '';
const headSha = (process.env.HEAD_SHA ?? '').slice(0, 7);
const configuredModel = process.env.GEMINI_MODEL?.trim() || '';

if (!githubToken || !repo || !prNumber) {
  console.error('Faltan variables de entorno de GitHub (GITHUB_TOKEN, GITHUB_REPOSITORY o PR_NUMBER).');
  process.exit(1);
}

const diffStat = existsSync(process.env.DIFF_STAT_PATH ?? '')
  ? readFileSync(process.env.DIFF_STAT_PATH, 'utf8').trim()
  : '';
const rawDiff = existsSync(process.env.DIFF_PATCH_PATH ?? '')
  ? readFileSync(process.env.DIFF_PATCH_PATH, 'utf8')
  : '';

if (!rawDiff.trim()) {
  console.log('El diff de la PR está vacío (o solo afecta a package-lock.json). Se omite la revisión.');
  process.exit(0);
}

const truncated = rawDiff.length > MAX_DIFF_CHARS;
const diffForPrompt = truncated
  ? `${rawDiff.slice(0, MAX_DIFF_CHARS)}\n\n... [Diff truncado a ${MAX_DIFF_CHARS} caracteres]`
  : rawDiff;

const agentsGuidelines = existsSync('AGENTS.md')
  ? readFileSync('AGENTS.md', 'utf8').slice(0, 12_000)
  : '';

const prompt = `Eres un revisor senior de código Angular/TypeScript para el proyecto **TAI Study**.
Revisa esta Pull Request en **español**, de forma concisa, práctica y accionable.

## Directrices del repositorio (AGENTS.md)
${agentsGuidelines}

## Contexto de la PR
- **Título:** ${prTitle}
- **Descripción:**
${prBody || '(Sin descripción)'}

## Resumen de archivos cambiados
\`\`\`
${diffStat}
\`\`\`

## Diff de la PR
\`\`\`diff
${diffForPrompt}
\`\`\`

## Instrucciones de salida
Estructura tu respuesta en Markdown con estas secciones:
1. **Veredicto general:** (Aprobado / Aprobado con sugerencias / Requiere cambios) + resumen en 2-3 líneas.
2. **Posibles bugs o riesgos:** (solo problemas reales: edge cases, condiciones de carrera, validación de datos, migraciones Dexie/Backup, pérdida de estado). Si no hay, indícalo brevemente.
3. **Cumplimiento de arquitectura y Angular 22:** (local-first, Signals, standalone, control flow, repositorio/store, tema oscuro).
4. **Sugerencias de mejora y tests:** (máximo 5 puntos priorizados con archivo y contexto concreto).

Evita elogios genéricos y no repitas el diff.`;

async function upsertPrComment(body) {
  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const listUrl = `https://api.github.com/repos/${repo}/issues/${prNumber}/comments?per_page=100`;
  const listRes = await fetch(listUrl, { headers });
  if (!listRes.ok) {
    throw new Error(`No se pudieron listar comentarios de la PR (${listRes.status})`);
  }

  const comments = await listRes.json();
  const existing = comments.find(
    (comment) => typeof comment.body === 'string' && comment.body.includes(COMMENT_MARKER),
  );

  const targetUrl = existing
    ? `https://api.github.com/repos/${repo}/issues/comments/${existing.id}`
    : `https://api.github.com/repos/${repo}/issues/${prNumber}/comments`;

  const saveRes = await fetch(targetUrl, {
    method: existing ? 'PATCH' : 'POST',
    headers,
    body: JSON.stringify({ body }),
  });

  if (!saveRes.ok) {
    const errText = await saveRes.text();
    throw new Error(`Error publicando comentario en GitHub (${saveRes.status}): ${errText}`);
  }

  console.log(existing ? `Comentario de revisión actualizado (#${existing.id}).` : 'Comentario de revisión publicado.');
}

try {
  const { text: reviewMarkdown, usedModel } = await generateWithGemini({
    apiKey,
    prompt,
    configuredModel,
    preferredTier: 'flash',
    temperature: 0.2,
    maxOutputTokens: 2048,
  });
  const footerNote = truncated
    ? `\n\n> ℹ️ El diff superó ${MAX_DIFF_CHARS.toLocaleString('es-ES')} caracteres y fue truncado para la revisión.`
    : '';
  const finalComment = [
    COMMENT_MARKER,
    `## 🤖 Revisión automática con Gemini (\`${usedModel}\`)`,
    `_Commit revisado: \`${headSha || 'HEAD'}\`_`,
    '',
    reviewMarkdown + footerNote,
  ].join('\n');

  await upsertPrComment(finalComment);
} catch (error) {
  if (error?.isTransient) {
    console.log(
      `::warning::Se omitió la revisión automática por indisponibilidad temporal de Gemini: ${error.message}`,
    );
    process.exit(0);
  }
  console.error('Error durante la revisión con Gemini:', error);
  process.exit(1);
}
