const axios = require('axios');

const MAX_INPUT_JSON_CHARS = 80000;

/** OWASP API Security Top 10 (2023) — reference for the model only. */
const OWASP_API_TOP10_2023 = `
OWASP API Security Top 10 (2023) — use these IDs in output:
- API1: Broken Object Level Authorization (BOLA / IDOR-style access risks)
- API2: Broken Authentication
- API3: Broken Object Property Level Authorization (mass assignment / excessive data exposure)
- API4: Unrestricted Resource Consumption (rate limits, DoS)
- API5: Broken Function Level Authorization
- API6: Unrestricted Access to Sensitive Business Flows
- API7: Server Side Request Forgery (SSRF)
- API8: Security Misconfiguration (TLS, headers, verbose errors, default creds)
- API9: Improper Inventory Management (shadow/deprecated APIs)
- API10: Unsafe Consumption of APIs (trust of third-party APIs)
`.trim();

/**
 * Extract first top-level JSON object using brace depth.
 */
function extractJsonObject(s) {
  if (!s || typeof s !== 'string') return null;
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === '\\' && inStr) {
      esc = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function parseModelJson(text) {
  let s = String(text).trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const extracted = extractJsonObject(s);
  if (!extracted) throw new Error('No JSON object found in model output');
  return JSON.parse(extracted);
}

/**
 * Reject when the model echoes OpenAPI / probe payload instead of the report schema.
 */
function validateSecurityReport(data) {
  if (!data || typeof data !== 'object') {
    return 'Response is not a JSON object';
  }
  if (data.swagger === '2.0' || typeof data.openapi === 'string' || data.openapi === '3.0.0') {
    return 'Model echoed OpenAPI root fields (swagger/openapi) instead of the security report';
  }
  if (data.paths && typeof data.paths === 'object' && !Array.isArray(data.endpoints)) {
    return 'Model echoed OpenAPI paths map; expected endpoints array + executiveSummary';
  }
  if (Array.isArray(data.probes) && (data.host || data.basePath !== undefined) && !data.executiveSummary) {
    return 'Model echoed probe/spec hybrid; expected analysis schema only';
  }
  if (typeof data.executiveSummary !== 'string') {
    return 'Missing string field executiveSummary';
  }
  if (!Array.isArray(data.endpoints)) {
    return 'Missing array field endpoints (use [] if nothing to report)';
  }
  return null;
}

/**
 * OWASP-oriented analysis via Ollama.
 * Note: Ollama `format: "json"` often makes small models emit JSON that looks like the input spec;
 * default is OFF — enable with OLLAMA_SECURITY_JSON_FORMAT=1 if your model handles it well.
 */
async function runSecurityOllama(payload, getOllamaConfig) {
  const cfg = getOllamaConfig();
  const useJsonFormat = String(process.env.OLLAMA_SECURITY_JSON_FORMAT || '0') === '1';

  const probesJson = JSON.stringify({
    liveEnabled: payload.liveEnabled,
    probes: payload.probes || [],
    probeSkipped: payload.probeSkipped || [],
  });
  let specBlock = String(payload.specExcerpt || '');
  if (specBlock.length > MAX_INPUT_JSON_CHARS) {
    specBlock =
      specBlock.slice(0, MAX_INPUT_JSON_CHARS) +
      '\n…[spec truncated for prompt size]';
  }

  const outputSchema = `YOUR OUTPUT MUST BE EXACTLY ONE JSON OBJECT with ONLY these top-level keys:
- "executiveSummary" (string)
- "owaspReference" (string, use: "OWASP API Security Top 10 (2023)")
- "endpoints" (array)

Do NOT include "swagger", "openapi", "paths", "info", "host", "probes", or any OpenAPI document fields in your output.
Do NOT copy the CONTEXT block below into your answer.

Each endpoints[] item:
{ "path": "/path", "method": "get", "issues": [ { "owaspId": "API1", "owaspName": "...", "severity": "medium", "description": "...", "remediation": "...", "evidenceFromSpecOrProbes": "..." } ] }`;

  const instructions = `You are an API security analyst. Review the CONTEXT using OWASP API Security Top 10 (2023). You did not run exploits.

${OWASP_API_TOP10_2023}

${outputSchema}

---BEGIN_CONTEXT_OPENAPI_JSON---
${specBlock}
---END_CONTEXT_OPENAPI_JSON---

---BEGIN_PROBE_RESULTS_JSON---
${probesJson}
---END_PROBE_RESULTS_JSON---

Rules:
- Base every issue on CONTEXT or PROBE_RESULTS (parameter names, security, schemes http/https, status codes, response snippets).
- No invented CVEs.
- owaspId must be API1 through API10.

Now output ONLY the analysis JSON object (no markdown, no explanation).`;

  async function callOllama(userPrompt, jsonFormat) {
    const req = {
      model: cfg.model,
      prompt: userPrompt,
      stream: false,
    };
    if (jsonFormat && useJsonFormat) {
      req.format = 'json';
    }
    const res = await axios.post(cfg.generateUrl, req, { timeout: 180000 });
    return res.data && res.data.response != null ? String(res.data.response) : '';
  }

  function tryParseAndValidate(raw) {
    const data = parseModelJson(raw);
    const err = validateSecurityReport(data);
    if (err) throw new Error(err);
    return data;
  }

  const retries = [
    { extra: '', jsonFormat: useJsonFormat },
    {
      extra: '\n\nCRITICAL: Last output was rejected (echoed OpenAPI or wrong shape). Output ONLY { "executiveSummary", "owaspReference", "endpoints" }. endpoints may be [].',
      jsonFormat: false,
    },
    {
      extra: '\n\nReply with minimal valid JSON. Example shape: {"executiveSummary":"Brief OWASP-style overview.","owaspReference":"OWASP API Security Top 10 (2023)","endpoints":[{"path":"*","method":"*","issues":[{"owaspId":"API8","owaspName":"Security Misconfiguration","severity":"medium","description":"...","remediation":"...","evidenceFromSpecOrProbes":"..."}]}]}',
      jsonFormat: false,
    },
  ];

  let lastRaw = '';
  let lastErr = '';

  try {
    for (let i = 0; i < retries.length; i++) {
      const { extra, jsonFormat } = retries[i];
      lastRaw = await callOllama(instructions + extra, jsonFormat);
      try {
        const data = tryParseAndValidate(lastRaw);
        return { ok: true, data, raw: lastRaw };
      } catch (e) {
        lastErr = e.message || String(e);
      }
    }
    return {
      ok: false,
      error: lastErr || 'Validation failed after retries',
      raw: lastRaw,
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message || String(err),
      raw: lastRaw,
    };
  }
}

module.exports = {
  runSecurityOllama,
  OWASP_API_TOP10_2023,
  parseModelJson,
  extractJsonObject,
  validateSecurityReport,
};
