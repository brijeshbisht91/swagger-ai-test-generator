const axios = require('axios');

const DEFAULT_PARAM_VALUES = {
  petId: '1',
  orderId: '1',
  username: 'user1',
  name: 'probe',
  tag: 'probe',
  apiKey: '',
};

const SAFE_METHODS_DEFAULT = ['get', 'head'];
const SAFE_METHODS_MUTATING = ['get', 'head', 'options', 'delete'];

function mergedParameters(pathItem, method) {
  const op = pathItem[method];
  return [...(pathItem.parameters || []), ...((op && op.parameters) || [])];
}

/**
 * Replace {param} segments in an OpenAPI path with sample values.
 */
function resolvePath(apiPath, pathItem, method) {
  const params = mergedParameters(pathItem, method);
  const pathParams = params.filter((p) => p && p.in === 'path');
  let resolved = apiPath;
  for (const p of pathParams) {
    const name = p.name;
    const val =
      DEFAULT_PARAM_VALUES[name] ??
      (p.type === 'integer' || p.type === 'number' ? '1' : 'probe');
    if (val === '' && p.required) {
      return { urlPath: null, skipReason: `required path param "${name}" has no safe default` };
    }
    const token = `{${name}}`;
    if (!resolved.includes(token)) {
      continue;
    }
    resolved = resolved.split(token).join(encodeURIComponent(val));
  }
  if (/\{[^}]+\}/.test(resolved)) {
    return {
      urlPath: null,
      skipReason: 'unresolved path placeholders remain',
    };
  }
  return { urlPath: resolved, skipReason: null };
}

function buildQueryString(pathItem, method) {
  const op = pathItem[method];
  if (!op) return '';
  const parameters = mergedParameters(pathItem, method);
  const parts = [];
  for (const p of parameters) {
    if (!p || p.in !== 'query' || !p.name) continue;
    if (p.required) {
      const v =
        DEFAULT_PARAM_VALUES[p.name] ??
        (p.type === 'integer' || p.type === 'number' ? '1' : 'x');
      parts.push(`${encodeURIComponent(p.name)}=${encodeURIComponent(v)}`);
    }
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

function pickHeaders() {
  const raw = process.env.SECURITY_PROBE_AUTH_HEADER;
  if (!raw || !raw.trim()) return {};
  return { Authorization: raw.trim() };
}

/**
 * @param {object} spec - Swagger 2.0
 * @param {string} baseUrl - e.g. https://petstore.swagger.io/v2 (no trailing slash)
 * @returns {Promise<{ probes: object[], skipped: object[], notice?: string }>}
 */
async function runLiveProbes(spec, baseUrl) {
  const maxEndpoints = parseInt(
    process.env.SECURITY_PROBE_MAX_ENDPOINTS || '25',
    10
  );
  const timeoutMs = parseInt(
    process.env.SECURITY_PROBE_TIMEOUT_MS || '10000',
    10
  );
  const allowMutating =
    String(process.env.SECURITY_PROBE_ALLOW_MUTATING || '0') === '1';
  const allowedMethods = allowMutating
    ? SAFE_METHODS_MUTATING
    : SAFE_METHODS_DEFAULT;

  const root = baseUrl.replace(/\/$/, '');
  const paths = spec.paths || {};
  const entries = [];

  for (const [apiPath, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const method of allowedMethods) {
      if (!pathItem[method]) continue;
      entries.push({ apiPath, method, pathItem });
    }
  }

  entries.sort((a, b) =>
    `${a.apiPath} ${a.method}`.localeCompare(`${b.apiPath} ${b.method}`)
  );

  const selected = entries.slice(0, Math.max(1, maxEndpoints));
  const probes = [];
  const skipped = [];

  for (const { apiPath, method, pathItem } of selected) {
    const { urlPath, skipReason } = resolvePath(apiPath, pathItem, method);
    if (!urlPath) {
      skipped.push({ path: apiPath, method, reason: skipReason });
      continue;
    }

    const qs = buildQueryString(pathItem, method);
    const url = `${root}${urlPath.startsWith('/') ? '' : '/'}${urlPath}${qs}`;

    const start = Date.now();
    try {
      const res = await axios({
        method,
        url,
        timeout: timeoutMs,
        maxRedirects: 5,
        validateStatus: () => true,
        headers: {
          Accept: 'application/json',
          ...pickHeaders(),
        },
        ...(method === 'delete' ? { data: undefined } : {}),
      });
      const durationMs = Date.now() - start;
      const headers = res.headers || {};
      const probeHeaders = {
        'strict-transport-security': headers['strict-transport-security'],
        'x-content-type-options': headers['x-content-type-options'],
        'cache-control': headers['cache-control'],
        'www-authenticate': headers['www-authenticate'],
      };
      let bodySnippet = '';
      if (typeof res.data === 'string') {
        bodySnippet = res.data.slice(0, 200);
      } else if (res.data != null) {
        try {
          bodySnippet = JSON.stringify(res.data).slice(0, 200);
        } catch {
          bodySnippet = '';
        }
      }

      probes.push({
        path: apiPath,
        method,
        url,
        status: res.status,
        durationMs,
        responseHeaders: probeHeaders,
        bodySnippet,
      });
    } catch (err) {
      probes.push({
        path: apiPath,
        method,
        url,
        error: err.message || String(err),
        durationMs: Date.now() - start,
      });
    }
  }

  return { probes, skipped };
}

module.exports = { runLiveProbes, resolvePath };
