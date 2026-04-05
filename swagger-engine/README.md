# Swagger engine

Grouped by **use**. Paths are resolved from **`config.js`** (`ENGINE_ROOT` defaults to this folder, or `SWAGGER_ENGINE_DIR`).

| Folder | Purpose |
|--------|---------|
| **`specs/`** | OpenAPI snapshots and diff outputs: `swagger-latest.json`, `swagger-prev.json`, `swagger-diff.json`, `swagger-changes.json` |
| **`reports/`** | Security scan outputs: `security-report.json`, `security-report.md` |
| **`fetch/`** | `fetchSwagger.js` — download spec, rotate snapshots |
| **`diff/`** | `diffSwagger.js`, `analyzeDiff.js` — path diff + structured change rows |
| **`security/`** | `securityScan.js`, `securityOllama.js`, `liveProbe.js` — OWASP-style LLM review + optional HTTP probes |
| **`config.js`** | Shared paths + `getOllamaConfig()` for Node scripts |

**npm scripts** (from repo root):

- `npm run swagger:fetch` → `node swagger-engine/fetch/fetchSwagger.js`
- `npm run swagger:diff` → `node swagger-engine/diff/diffSwagger.js`
- `npm run security:scan` → `node swagger-engine/security/securityScan.js`

`app.js` at the repo root requires `./swagger-engine/config.js` only (unchanged).
