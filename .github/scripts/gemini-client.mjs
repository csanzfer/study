const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

const EXCLUDED_MODEL_PATTERNS = [
  'embedding',
  'imagen',
  'veo',
  'tts',
  'audio',
  'live',
  'robotics',
  'computer-use',
  'aqa',
  'deep-research',
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTierScore(id, preferredTier) {
  const isPro = id.includes('pro');
  const isLite = id.includes('lite');
  const isFlash = id.includes('flash') && !isLite;

  if (preferredTier === 'flash') {
    if (isFlash) return 3;
    if (isPro) return 2;
    if (isLite) return 1;
    return 0;
  }

  // Por defecto ('pro'): prioriza capacidad de razonamiento
  if (isPro) return 3;
  if (isFlash) return 2;
  if (isLite) return 0;
  return 1;
}

function scoreModelName(rawName, preferredTier) {
  const id = rawName.replace(/^models\//, '').toLowerCase();
  const tierScore = getTierScore(id, preferredTier);

  const versionMatch = id.match(/gemini-(\d+)(?:\.(\d+))?/);
  const major = versionMatch ? Number(versionMatch[1]) : 0;
  const minor = versionMatch && versionMatch[2] ? Number(versionMatch[2]) : 0;

  let stabilityScore = 2;
  if (id.includes('exp')) stabilityScore = 0;
  else if (id.includes('preview')) stabilityScore = 1;

  const hasDateOrRevision = /(?:-\d{2}-\d{2}|-\d{3})$/.test(id);
  const aliasScore = hasDateOrRevision ? 0 : 1;

  return { id, tierScore, major, minor, stabilityScore, aliasScore };
}

export function rankCandidateModels(models, preferredTier = 'pro') {
  return models
    .filter((m) => {
      const id = (m.name ?? '').replace(/^models\//, '').toLowerCase();
      const methods = m.supportedGenerationMethods ?? [];
      if (!methods.includes('generateContent')) return false;
      if (!id.startsWith('gemini-')) return false;
      if (EXCLUDED_MODEL_PATTERNS.some((pattern) => id.includes(pattern))) return false;
      return true;
    })
    .map((m) => scoreModelName(m.name, preferredTier))
    .sort((a, b) => {
      if (b.tierScore !== a.tierScore) return b.tierScore - a.tierScore;
      if (b.major !== a.major) return b.major - a.major;
      if (b.minor !== a.minor) return b.minor - a.minor;
      if (b.stabilityScore !== a.stabilityScore) return b.stabilityScore - a.stabilityScore;
      if (b.aliasScore !== a.aliasScore) return b.aliasScore - a.aliasScore;
      return b.id.localeCompare(a.id);
    })
    .map((item) => item.id);
}

async function discoverAvailableModels(apiKey, preferredTier) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`No se pudo consultar ListModels (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  const ranked = rankCandidateModels(data.models ?? [], preferredTier);
  if (ranked.length === 0) {
    throw new Error('ListModels no devolvió ningún modelo Gemini compatible con generateContent.');
  }
  console.log(
    `Modelos Gemini detectados automáticamente (tier=${preferredTier}, top 5): ${ranked.slice(0, 5).join(', ')}`,
  );
  return ranked;
}

async function callGeminiModel({ apiKey, modelId, prompt, temperature, maxOutputTokens }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens,
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
        throw new Error(`Respuesta vacía de Gemini API (${modelId}): ${JSON.stringify(data)}`);
      }

      return text;
    }

    const errorBody = await response.text();
    if (response.status === 404) {
      const notFoundError = new Error(`Modelo no disponible (${modelId}): ${errorBody}`);
      notFoundError.isModelNotFound = true;
      throw notFoundError;
    }

    if (RETRYABLE_STATUSES.has(response.status)) {
      if (attempt < MAX_ATTEMPTS) {
        const delayMs = attempt * 10_000;
        console.log(
          `::warning::Gemini API (${modelId}) devolvió ${response.status} (intento ${attempt}/${MAX_ATTEMPTS}). Reintentando en ${delayMs / 1000}s...`,
        );
        await sleep(delayMs);
        continue;
      }

      const transientError = new Error(
        `Gemini API (${modelId}) temporalmente no disponible (${response.status}): ${errorBody}`,
      );
      transientError.isTransient = true;
      throw transientError;
    }

    throw new Error(`Gemini API (${modelId}) devolvió ${response.status}: ${errorBody}`);
  }
}

export async function generateWithGemini({
  apiKey,
  prompt,
  configuredModel = '',
  preferredTier = 'pro',
  temperature = 0.2,
  maxOutputTokens = 2048,
}) {
  if (configuredModel) {
    try {
      const text = await callGeminiModel({
        apiKey,
        modelId: configuredModel,
        prompt,
        temperature,
        maxOutputTokens,
      });
      return { text, usedModel: configuredModel };
    } catch (error) {
      if (!error?.isModelNotFound) throw error;
      console.log(
        `::warning::El modelo configurado "${configuredModel}" devolvió 404. Buscando automáticamente un modelo disponible con ListModels...`,
      );
    }
  }

  const discovered = await discoverAvailableModels(apiKey, preferredTier);
  const candidates = discovered.filter((id) => id !== configuredModel).slice(0, 3);
  let lastError;

  for (const candidate of candidates) {
    try {
      console.log(`Intentando generación con el modelo: ${candidate}`);
      const text = await callGeminiModel({
        apiKey,
        modelId: candidate,
        prompt,
        temperature,
        maxOutputTokens,
      });
      return { text, usedModel: candidate };
    } catch (error) {
      lastError = error;
      if (error?.isModelNotFound || error?.isTransient) {
        console.log(
          `::warning::No se pudo usar "${candidate}": ${error.message}. Probando siguiente candidato...`,
        );
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error('No se pudo completar la petición con ningún modelo Gemini disponible.');
}
