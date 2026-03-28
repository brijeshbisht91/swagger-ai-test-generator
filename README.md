# Swagger AI

Node tooling that **fetches OpenAPI (Swagger) specs**, **diffs path-level changes**, and uses **Ollama** to generate or update **Java TestNG + Rest Assured** tests under `java-tests/`.

## End-to-end flow

```mermaid
flowchart TB
  subgraph sources["Inputs"]
    Remote["Remote OpenAPI JSON\n(e.g. Petstore)"]
    Prev["swagger-engine/swagger-prev.json"]
    Latest["swagger-engine/swagger-latest.json"]
  end

  subgraph engine["Swagger change engine (no LLM)"]
    Fetch["swagger-engine/fetchSwagger.js\nnpm run swagger:fetch"]
    Diff["swagger-engine/diffSwagger.js\nnpm run swagger:diff"]
    Analyze["swagger-engine/analyzeDiff.js\nclassify + split per HTTP method"]
    DiffOut["swagger-diff.json\n(raw deep-diff)"]
    ChangesOut["swagger-changes.json\n(structured changes)"]
  end

  subgraph ai["Test generation (Ollama)"]
    App["app.js\nnode app.js"]
    Ollama["Ollama /api/generate\n(llama3.2:3b)"]
    JavaTests["java-tests/.../tests/*Test.java"]
  end

  subgraph verify["Verification"]
    Maven["mvn test\n(java-tests)"]
  end

  Remote --> Fetch
  Prev --> Fetch
  Latest --> Fetch
  Fetch -->|"copy latest → prev, then write new"| Latest

  Prev --> Diff
  Latest --> Diff
  Diff --> Analyze
  Analyze --> DiffOut
  Analyze --> ChangesOut

  ChangesOut --> App
  App -->|"prompt + optional existing file"| Ollama
  Ollama -->|"Java source"| App
  App --> JavaTests

  JavaTests --> Maven
```

### What each stage does

| Stage | Command / entry | Output |
|--------|------------------|--------|
| Fetch | `npm run swagger:fetch` | Updates `swagger-latest.json`; previous snapshot becomes `swagger-prev.json` when a prior latest exists. |
| Diff + analyze | `npm run swagger:diff` | Writes `swagger-diff.json` (path diff) and `swagger-changes.json` (categories: `ENDPOINT_CHANGE`, `BODY_CHANGE`, etc.). |
| AI update | `node app.js` | Reads `swagger-changes.json`, calls Ollama, writes/overwrites mapped `*Test.java` files. |

### Swagger engine layout

```mermaid
flowchart LR
  Config["config.js\n(paths + optional SWAGGER_ENGINE_DIR)"]
  FetchF["fetchSwagger.js"]
  DiffF["diffSwagger.js"]
  AnalyzeF["analyzeDiff.js"]
  Config --> FetchF
  Config --> DiffF
  DiffF --> AnalyzeF
```

All engine artifacts live under **`swagger-engine/`** so the repo root stays clean. Override the folder with:

```bash
SWAGGER_ENGINE_DIR=/path/to/engine node app.js
```

If **`swagger-changes.json` looks empty or never updates**, check the terminal output from `npm run swagger:diff`: it prints the **absolute paths** where files were written. Common causes: **`SWAGGER_ENGINE_DIR`** is set (outputs go to that folder, not the copy you have open in the editor), the command was run from a **different clone**, or the IDE buffer did not reload from disk (reopen the file or **Reload from Disk**). When `swagger-prev.json` and `swagger-latest.json` **paths are identical**, `swagger-changes.json` is valid JSON **`[]`** (no API changes), not a blank file.

### Docker / CI (conceptual)

- **Docker Compose**: `ollama` service + `swagger-app` running `node app.js` with `OLLAMA_HOST=http://ollama:11434`.
- **GitHub Actions** (`.github/workflows/api-test.yml`): Ollama service, `npm install`, pull model, `node app.js`, then `mvn clean test` in `java-tests/`.

## Prerequisites

- Node 18+
- Java 17 + Maven (for `java-tests`)
- Ollama running locally (or `OLLAMA_HOST` pointing at your server) with model **`llama3.2:3b`** pulled

## Quick start

```bash
npm install
npm run swagger:fetch    # refresh spec snapshots
npm run swagger:diff     # regenerate diff + analyzed changes
node app.js              # apply changes via Ollama → Java tests
cd java-tests && mvn test
```

## Security scanning

Runs an **OWASP API Security Top 10 (2023)**–oriented review: **Ollama** analyzes a **truncated OpenAPI JSON** excerpt from `swagger-engine/swagger-latest.json`, plus optional **live HTTP probe** results (`API_BASE_URL`). There is **no** separate static rule engine and **no** OWASP ZAP integration—only LLM-structured output from your spec and probes.

**Advisory only:** this is not a penetration test, not OWASP ZAP, and not a certification. See [OWASP API Security](https://owasp.org/www-project-api-security/).

```bash
# Requires Ollama and a spec at swagger-engine/swagger-latest.json
export API_BASE_URL=https://petstore.swagger.io/v2   # optional; adds probe facts for the model
npm run security:scan
```

Outputs (always written when the script finishes, even if Ollama fails):

- `swagger-engine/security-report.json` — includes `findings` (flattened OWASP-tagged rows), `llm` raw analysis, `liveProbe`
- `swagger-engine/security-report.md` — same content as Markdown (open this path after each run)

If `SWAGGER_ENGINE_DIR` is set, both files are written under **that directory** instead—check the console lines `Wrote Markdown: /absolute/path/...`.

### Environment variables

| Variable | Purpose |
|----------|---------|
| `API_BASE_URL` | Base URL for live probes (no trailing slash). If unset, analysis is **spec-only** (still sent to Ollama). |
| `OLLAMA_HOST` | Ollama base URL (default `http://localhost:11434`). |
| `OLLAMA_MODEL` | Model tag (default `llama3.2:3b`). |
| `OLLAMA_SECURITY_JSON_FORMAT` | Default `0`: plain text JSON from the model (avoids echoing the OpenAPI doc when `format: json` is on). Set to `1` only if your model reliably returns the analysis schema with `format: json`. |
| `SECURITY_PROBE_ALLOW_MUTATING` | Default `0`: only **GET** and **HEAD**. Set to `1` to also allow **OPTIONS** and **DELETE** (still no POST bodies). |
| `SECURITY_PROBE_MAX_ENDPOINTS` | Cap live probes (default `25`). |
| `SECURITY_PROBE_TIMEOUT_MS` | Per-request timeout (default `10000`). |
| `SECURITY_PROBE_AUTH_HEADER` | Value for the `Authorization` header on probes (e.g. `Bearer <token>`). |

### Flow (security)

```mermaid
flowchart LR
  Spec[swagger_latest.json]
  Probe[liveProbe.js]
  Ollama[securityOllama.js OWASP Top10]
  Json[security_report.json]
  Md[security_report.md]
  Spec --> Scan[securityScan.js]
  Probe --> Scan
  Scan --> Ollama
  Ollama --> Scan
  Scan --> Json
  Scan --> Md
```

## Notes

- **Class names** are tied to the target filename (e.g. `PutpetTest.java` → `public class PutpetTest`); `app.js` enforces that after generation so the model cannot rename classes from `operationId` alone.
- **Endpoint renames** in the spec (e.g. typo path → correct path) are paired **per HTTP method** so POST and PUT map to different test files (`PostpetTest`, `PutpetTest`, etc.).
