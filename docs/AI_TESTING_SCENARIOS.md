# AI testing guide: scenarios and validation

This document describes **testing scenarios** for the Swagger AI pipeline (LangGraph → embeddings → RAG retrieval → LLM-generated Java tests). Use it for **test planning**, **QA checklists**, and **enterprise AI assurance** (e.g. Revamp-style delivery).

**Related code:** `graph/nodes/embed.py`, `graph/nodes/generate.py`, `graph/swagger_diff.py`, `swagger_ai_graph.py`, CI: `.github/workflows/api-test.yml`.

---

## 1. Architecture snapshot (what we validate)

| Stage | Component | Risk focus |
|--------|-----------|------------|
| Load / diff | `swagger.previous.json` vs current spec | Wrong or missing change detection |
| Chunk | One text chunk per `(path, method)` | Fragment boundaries, missing ops |
| Embed | `OllamaEmbeddings.embed_documents` + L2-normalized rows | Vector quality, model mismatch |
| Retrieve | `embed_query` + cosine similarity to pick **top-1** chunk | Wrong fragment → wrong tests |
| Generate | `ChatOllama` + prompt + `sanitize_java_source` | Hallucinated APIs, invalid Java |
| Verify | `mvn test` (CI) | End-to-end correctness |

Two common **enterprise use-case families** this repo exemplifies: **retrieval-grounded QA (RAG)** and **generative automation** (code/test synthesis).

**Single-line test cases (architecture / pipeline):**

- Diff between `swagger.previous.json` and current spec lists correct added/removed/modified operations for a known spec change.
- Every `(path, method)` in `paths` produces exactly one chunk whose text includes that method and path.
- `embed_documents` completes for all chunk strings and yields a matrix row count equal to `len(chunks)`.
- For a labeled query, `argmax(cosine)` over the matrix returns the chunk index that matches the intended operation.
- Generated Java for a target passes `sanitize_java_source` and compiles without manual edit.
- `mvn clean test` passes in CI after `swagger_ai_graph.py --force-all` with pinned models.

---

## 2. Hallucination testing scenarios

Hallucinations here mean: **claims or code not supported by the OpenAPI fragment or the stated endpoint** (wrong path, method, field, status code, or invented APIs).

| ID | Scenario | How to test | Pass criteria |
|----|----------|-------------|----------------|
| H1 | Model invents a **second endpoint** or extra `@Test` | Inspect generated Java; count `@Test` and URL paths | Exactly **one** `@Test`; only target `{path}` + `{method}` |
| H2 | Wrong **HTTP method** (e.g. GET vs POST) | Compare to spec under `swagger["paths"][path][method]` | Method matches spec |
| H3 | Wrong **path** (e.g. `/pets` vs `/pet`) | Grep for `RestAssured` base path segments | Aligns with spec path for the target |
| H4 | Invented **request/response fields** not in fragment | Compare JSON keys in body builders/assertions to retrieved schema | No unsupported required fields unless spec allows |
| H5 | Wrong **base URL** | Prompt requires Petstore v2 base URI | Assertions/requests use configured base (e.g. `https://petstore.swagger.io/v2`) per project rules |
| H6 | **Markdown or prose** instead of Java | Run `strip_markdown_code_fence` path; file compiles | Valid `.java`; `javac`/Maven succeeds |
| H7 | **Class/file name drift** | Run Maven; check public class name | Matches `java_class_name` / filename (see `enforce_public_class_name`) |
| H8 | Cross-endpoint **bleed** (parameters from another operation) | Manual or diff review when similar paths exist (`/pet/{id}` vs `/store/order/{id}`) | Parameters match **this** operation only |

**Automation ideas:** static checks (regex/AST) for single `@Test`, forbidden extra `given().get/post/...` paths; optional **LLM-as-judge** rubric: “Does this Java only implement the stated operation?” scored 1–5, with **human arbitration** on low scores.

**Single-line test cases:**

- Generated class contains exactly one `@Test` and exercises only the target path and HTTP method.
- Rest Assured (or equivalent) uses the same HTTP method the OpenAPI spec defines for that path.
- Request paths in code match the spec path template for the target (no `/pets` vs `/pet` style drift).
- Request/response JSON keys used in the test exist in or are allowed by the retrieved operation schema.
- Base URI matches the project rule (e.g. Petstore v2) in every generated test.
- Output is valid Java source after fence stripping and compiles under Maven.
- Public class name equals the expected stem from path/method and matches the `.java` filename.
- For similar paths, path parameters and assertions belong only to the target operation, not a neighbor.

---

## 3. RAG testing cases

RAG = retrieve the **best** OpenAPI chunk before generation. Implementation uses **cosine similarity** after L2-normalizing query and document vectors (`graph/nodes/embed.py`, `graph/nodes/generate.py`).

| ID | Scenario | How to test | Pass criteria |
|----|----------|-------------|----------------|
| R1 | **Top-1 correctness** (golden set) | For each golden `(path, method)`, compute argmax cosine vs matrix; compare to **expected chunk index** or fingerprint | Match rate ≥ agreed threshold (e.g. 95% on golden set) |
| R2 | **Ambiguous paths** | Spec with many similar paths; run retrieval for each target query `"{METHOD} {path}"` | Each query retrieves chunk whose `(path, method)` equals target |
| R3 | **Spec update** | Change one operation’s schema; rebuild chunks/embeddings; re-run retrieval | Retrieved text includes new fields/constraints |
| R4 | **Retrieved vs exact** | Code path: if top-1 `retrieved != exact`, prompt **appends** exact fragment (`generate.py`) | After change, generation still receives full correct op JSON for that endpoint |
| R5 | **Empty / tiny spec** | Minimal `paths` | No crash; skip or clear failure for missing `path`/`method` |
| R6 | **Regression** | Pin `OLLAMA_EMBED_MODEL` and chunk text format; store baseline **similarity scores** per query | Scores stable within tolerance across runs |

**Metrics:** top-1 accuracy, MRR@k (if you log top-k), distribution of cosine scores for correct vs incorrect pairs (sanity check).

**Single-line test cases:**

- Top-1 retrieved chunk matches the golden `(path, method)` for every row in the golden set.
- Query `GET /pet/{petId}` retrieves the GET pet-by-id chunk, not POST `/pet` or DELETE `/pet/{petId}`.
- After a schema edit to one operation, re-embed and confirm the retrieved chunk text includes the new fields.
- When top-1 text differs from the exact operation JSON, the prompt still includes the exact fragment for that target.
- Minimal or empty `paths` does not crash retrieval; invalid targets are skipped or reported clearly.
- With fixed embed model and chunk text format, per-query similarity scores stay within an agreed tolerance across runs.

---

## 4. Query testing (embedding queries)

Queries are built as **`"{METHOD} {path}"`** (e.g. `GET /pet/{petId}`) then passed to `embed_query`.

| ID | Scenario | How to test | Pass criteria |
|----|----------|-------------|----------------|
| Q1 | **Case normalization** | `get` vs `GET` in `TARGET_ENDPOINTS` vs query string | Consistent behavior; chunk `method` is lowercased in chunks |
| Q2 | **Path spelling** | Typo in path vs spec | Should `Skip (not in spec)` or fail fast; no silent wrong file |
| Q3 | **Query format drift** | Alternate query strings: same path with/without host, with operation summary | Document **canonical** query form; assert retrieval stability if you change it |
| Q4 | **Multi-target batch** | All `TARGET_ENDPOINTS` in one run | Each query embedding independent; correct file per target |

**Tooling:** `python swagger_ai_graph.py --debug-ollama` logs embed/chat payloads; use `--print-chunks` to inspect chunk texts without LLM.

**Single-line test cases:**

- Lowercase vs uppercase method in config still yields the same retrieval target as the canonical `METHOD path` query.
- A typo or unknown path in `TARGET_ENDPOINTS` does not produce a Java file for a wrong spec operation (skip or explicit failure).
- Changing only the query string format (if ever allowed) is regression-tested so top-1 indices do not drift unintentionally.
- Running all `TARGET_ENDPOINTS` in one graph run produces one output file per target with no cross-mixed retrieval.

---

## 5. Model response validation checks

Validation = **structure and policy** on LLM output before/side-by-side with execution.

| ID | Check | Mechanism in repo / suggested |
|----|--------|-------------------------------|
| M1 | **Package / imports** | Prompt requires `package tests;` + `BaseTest`; `ensure_base_test_import` |
| M2 | **Public class name** | `enforce_public_class_name` vs expected `java_class_name` |
| M3 | **No fences** | `strip_markdown_code_fence` |
| M4 | **Compile** | `mvn clean test` |
| M5 | **Runtime API contract** | Rest Assured status/body assertions vs live or mock Petstore |
| M6 | **Determinism** | `temperature=0.2` in `ChatOllama`; pin model tag in CI (`llama3.2:3b`) |
| M7 | **Token/length** | Optional: cap output length; reject if no `class` / no `@Test` |

**LLM-as-judge (optional):** Pass “spec fragment + generated Java” to a separate model with a rubric (completeness, method correctness, no extra endpoints). Use only as **supplement** to compile + API tests.

**Single-line test cases:**

- Every generated file declares `package tests;` and imports `base.BaseTest` when the class extends `BaseTest`.
- The first `public class` name matches the enforced `java_class_name` for that endpoint.
- Raw model output has markdown fences removed before write/compile.
- `mvn clean test` succeeds with no compilation errors on the generated suite.
- Live or mock API responses satisfy the assertions the test encodes for the Petstore contract.
- Re-running generation with the same pinned model and temperature yields identical or acceptably close outputs for spot checks.
- Reject or flag outputs missing a `class` body or missing `@Test` before merge.

---

## 6. Embedding-related test cases

| ID | Scenario | How to test | Pass criteria |
|----|----------|-------------|----------------|
| E1 | **Model availability** | `OLLAMA_EMBED_MODEL` pulled; `/api/embed` succeeds | No embed failures on chunk batch |
| E2 | **Dimension consistency** | `len(embed_query(q)) == len(row)` for matrix rows | Matmul in `cosine_top1` valid |
| E3 | **Normalization** | `_normalize_rows`: zero-norm rows handled (`norms == 0 → 1.0`) | No NaNs; cosine in [-1, 1] |
| E4 | **Chat vs embed model** | Set `OLLAMA_EMBED_MODEL` to dedicated embed model (e.g. `nomic-embed-text`) | Retrieval quality vs baseline; README notes when chat model is weak at embed |
| E5 | **Batch size / rate** | Large `paths` count | Ollama completes `embed_documents`; watch timeouts in CI |
| E6 | **Deterministic ordering** | Chunk list order matches `chunk_matrix` row order | `top_i` indexes same chunk as `chunks[top_i]` |

**Single-line test cases:**

- `/api/embed` succeeds for the configured `OLLAMA_EMBED_MODEL` on the full chunk batch in CI.
- Query vector dimension equals every row dimension in `chunk_matrix` before `cosine_top1`.
- After L2 normalization, no row is NaN and similarity scores remain in the valid numeric range.
- Switching to a dedicated embed model (e.g. `nomic-embed-text`) meets or exceeds baseline top-1 accuracy on the golden set.
- A large OpenAPI spec completes `embed_documents` within CI timeout without rate-limit failures.
- Row index `i` of `chunk_matrix` always corresponds to `chunks[i]` for the same graph state.

---

## 7. End-to-end and CI alignment

| Layer | What runs | Document / config |
|--------|-----------|-------------------|
| CI | `python swagger_ai_graph.py --force-all` then `mvn clean test` | `.github/workflows/api-test.yml` |
| Artifacts | Allure + generated Java uploads | Regression review of diffs |
| Incremental (local) | Default: LLM only for **added/modified** or **missing** tests | `swagger.previous.json` + README |

**Single-line test cases:**

- GitHub Actions (or equivalent) runs `swagger_ai_graph.py --force-all` then `mvn clean test` green on `main`.
- CI uploads Allure and generated Java artifacts for every run for diff review.
- Local incremental run with baseline skips LLM for unchanged targets that already have a test file on disk.
- A PR that only changes non-spec files does not silently skip required regeneration when policy requires `--force-all`.

---

## 8. Test execution phases (planning → execution)

1. **Plan:** Define golden `(path, method)` set, acceptance thresholds (RAG top-1 %, CI green), model/prompt version pins.  
2. **Prepare:** Fixtures (swagger snapshots), Ollama/model pull, `TARGET_ENDPOINTS` aligned with spec.  
3. **Execute:** Run scenario tables (manual or automated), log R6/R1 metrics, file issues on H/R/M failures.  
4. **Sign-off:** Release bundle = **model IDs + embed model + prompt template + chunk format**; owner approves after green golden set + spot review.

**Single-line test cases:**

- Plan document names golden endpoints, RAG accuracy threshold, and CI green as release gates.
- Prepare step verifies Ollama reachability, model pulls, and `swagger.json` / `TARGET_ENDPOINTS` alignment before test execution.
- Execute step records RAG metrics, hallucination checklist results, and Maven outcome per build id.
- Sign-off ties a specific model tag + embed model + prompt revision to a passing golden run and approver id/date.

---

## 9. Traceability matrix (quick reference)

| Risk | Primary scenarios | Main mitigation |
|------|---------------------|-----------------|
| Wrong context | R1–R4, Q1–Q4 | Golden retrieval + exact-chunk merge in prompt |
| Invented API | H1–H5, M1–M5 | Prompt constraints + sanitize + Maven/API tests |
| Embed failure | E1–E6 | Dedicated embed model, normalization tests, CI health |
| Flaky LLM | H6–H8, M6 | Low temperature, `--force-all` in CI, incremental local |

**Single-line test cases:**

- Wrong-context defect reproduces on a golden query and is closed only after top-1 or exact-merge fix is verified.
- Invented-API defect is closed only after prompt/sanitize/static gate change plus green Maven on affected targets.
- Embed failure is closed only after model pull, dimension/norm checks, or timeout tuning passes in CI.
- Flaky LLM defect is closed only after temperature/model pin or regeneration policy change shows stable runs over N builds.

---

*Last updated: aligned with repository behavior at time of writing; adjust thresholds and golden sets per your program (e.g. Revamp).*
