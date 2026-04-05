const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const axios = require('axios');
const { paths: swaggerPaths } = require('./swagger-engine/config');

const JAVA_TESTS = path.join(__dirname, 'java-tests');
const PET_SERVICE = path.join(
  JAVA_TESTS,
  'src/test/java/services/PetService.java'
);

const OLLAMA_BASE = (process.env.OLLAMA_HOST || 'http://localhost:11434').replace(
  /\/$/,
  ''
);
const OLLAMA_URL = `${OLLAMA_BASE}/api/generate`;
const MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';

const FRAMEWORK_DOC_PATH = path.join(__dirname, 'docs', 'FRAMEWORK.md');

function loadFrameworkInstructions() {
  try {
    return fs.readFileSync(FRAMEWORK_DOC_PATH, 'utf8').trim();
  } catch (e) {
    console.warn(
      `⚠️  Could not read ${FRAMEWORK_DOC_PATH}; using minimal inline framework hint.`
    );
    return [
      'Use TestNG + Rest Assured.',
      'Tests in package tests; call services (PetService, UserService) instead of raw given() without spec.',
      'Use RequestSpecBuilderUtil.getPetstoreRequestSpec() or getRequestSpec(); config from config.properties.',
      'Use ResponseValidator for HTTP status; POJOs + TestDataBuilder for bodies.',
      'Do not extend BaseTest unless legacy; prefer service + explicit RequestSpecification.',
    ].join('\n');
  }
}

const FRAMEWORK_INSTRUCTIONS = loadFrameworkInstructions();

const STRICT_GENERATED_TEST_RULES = `
MANDATORY for this test class (violations break the build):
- Use TestNG: import org.testng.annotations.Test; annotate each test method with @Test.
- NEVER use public static void main.
- PetService and UserService are utility classes: ALL API calls are STATIC. The constructor is private — compilation FAILS on "new PetService()" or "new UserService()".
- NEVER declare a local variable holding a service instance (no PetService ps = …; no ps.createPet). ALWAYS call PetService.createPet(...) and UserService.* as static methods on the class name only.
- models.Pet uses Lombok @Data + constructors: NEVER Pet.builder() (there is no @Builder). Use TestDataBuilder.petMyPet(id) or the full (long, String, List<String>, String) constructor.
- Call only static methods that exist on PetService/UserService (match names/signatures in the attached PetService source).
`;

/** Reserved for future targeted generation; empty = unused. */
const TARGET_ENDPOINTS = [];

function loadOpenApiSpec() {
  try {
    return JSON.parse(fs.readFileSync(swaggerPaths.spec, 'utf8'));
  } catch (e) {
    console.warn(`⚠️  Could not read OpenAPI spec ${swaggerPaths.spec}: ${e.message}`);
    return null;
  }
}

function getOperationFromChange(spec, change) {
  if (!spec || !spec.paths) return null;
  const { path: p, method: m } = parseEndpoint(change.endpoint);
  const item = spec.paths[p];
  if (!item || !item[m]) return null;
  return { pathKey: p, method: m, operation: item[m] };
}

function pathLiteralSegments(apiPath) {
  return apiPath.split('/').filter((seg) => seg && !/^\{.+\}$/.test(seg));
}

/**
 * Heuristic: PetService source already mentions every non-{param} path segment after /pet (or /pet root).
 */
function petServiceLikelyHasPath(serviceSrc, apiPath) {
  const segs = pathLiteralSegments(apiPath);
  const nonPet = segs.filter((s) => s !== 'pet');
  if (nonPet.length === 0) {
    return serviceSrc.includes('"/pet"');
  }
  return nonPet.every((s) => serviceSrc.includes(s));
}

function mvnTestCompileResult() {
  try {
    const out = execSync('mvn -e -B test-compile', {
      cwd: JAVA_TESTS,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024
    });
    return { ok: true, log: out || '' };
  } catch (e) {
    const log = [e.stdout || '', e.stderr || '']
      .join('\n')
      .trim() || String(e.message || '');
    return { ok: false, log };
  }
}

function logMvnFailure(title, log) {
  console.warn(`⚠️  ${title}`);
  const text = (log || '').trim();
  const tail = text.length > 8000 ? text.slice(-8000) : text;
  console.warn(tail || '(no compiler output captured)');
}

function isPostPetUploadImageOperation(operationDetail) {
  if (!operationDetail || !operationDetail.pathKey) return false;
  const m = String(operationDetail.method || '').toLowerCase();
  return m === 'post' && operationDetail.pathKey.includes('uploadImage');
}

/**
 * Known-good Petstore uploadImage when the LLM-generated PetService does not compile.
 */
function tryApplyDeterministicPetUploadImage(operationDetail) {
  if (!isPostPetUploadImageOperation(operationDetail)) return false;
  if (!fs.existsSync(PET_SERVICE)) return false;
  let src = fs.readFileSync(PET_SERVICE, 'utf8');
  if (/uploadPetImage\s*\(/.test(src)) return true;
  if (!src.includes('import java.io.File')) {
    src = src.replace(
      'import static io.restassured.RestAssured.given;\n',
      'import static io.restassured.RestAssured.given;\n\nimport java.io.File;\n'
    );
  }
  if (!src.includes('import io.restassured.http.ContentType')) {
    src = src.replace(
      'import core.RequestSpecBuilderUtil;\n',
      'import core.RequestSpecBuilderUtil;\nimport io.restassured.http.ContentType;\n'
    );
  }
  const uploadBlock = `
    /** POST /pet/{petId}/uploadImage (multipart). */
    public static Response uploadPetImage(long petId, String additionalMetadata, File file) {
        io.restassured.specification.RequestSpecification req = given()
                .spec(RequestSpecBuilderUtil.getPetstoreRequestSpec())
                .contentType(ContentType.MULTIPART);
        if (additionalMetadata != null && !additionalMetadata.isEmpty()) {
            req = req.multiPart("additionalMetadata", additionalMetadata);
        }
        if (file != null) {
            req = req.multiPart("file", file);
        }
        return req.when().post("/pet/" + petId + "/uploadImage");
    }`;
  if (!src.includes(DELETE_PET_MARKER)) {
    console.warn(
      '⚠️  PetService: cannot find deletePet anchor for deterministic uploadPetImage'
    );
    return false;
  }
  src = src.replace(DELETE_PET_MARKER, DELETE_PET_MARKER + uploadBlock);
  fs.writeFileSync(PET_SERVICE, src);
  return true;
}

const DELETE_PET_MARKER = '.delete("/pet/" + id);\n    }';

/**
 * Ollama often emits uploadImage(long, File, String) while generated tests expect uploadPetImage(long, String, File).
 */
function ensureCanonicalUploadPetImageMethod(operationDetail) {
  if (!isPostPetUploadImageOperation(operationDetail)) return;
  if (!fs.existsSync(PET_SERVICE)) return;
  let src = fs.readFileSync(PET_SERVICE, 'utf8');
  if (/uploadPetImage\s*\(/.test(src)) return;
  if (!src.includes(DELETE_PET_MARKER)) return;

  const backup = src;
  let alias = '';

  if (
    /public\s+static\s+Response\s+uploadImage\s*\(\s*long\s+petId\s*,\s*File\s+file\s*,\s*String\s+additionalMetadata\s*\)/.test(
      src
    )
  ) {
    alias = `
    public static Response uploadPetImage(long petId, String additionalMetadata, File file) {
        return uploadImage(petId, file, additionalMetadata);
    }`;
  } else if (
    /public\s+static\s+Response\s+uploadImage\s*\(\s*long\s+petId\s*,\s*String\s+\w+\s*,\s*File\s+\w+\s*\)/.test(
      src
    )
  ) {
    alias = `
    public static Response uploadPetImage(long petId, String additionalMetadata, File file) {
        return uploadImage(petId, additionalMetadata, file);
    }`;
  }

  if (!alias) return;

  src = src.replace(DELETE_PET_MARKER, DELETE_PET_MARKER + alias);
  fs.writeFileSync(PET_SERVICE, src);
  const c = mvnTestCompileResult();
  if (!c.ok) {
    logMvnFailure('uploadPetImage alias failed compile; reverting PetService.', c.log);
    fs.writeFileSync(PET_SERVICE, backup);
  } else {
    console.log('👉 Added PetService.uploadPetImage alias (canonical name for tests).');
  }
}

/** After any PetService sync: canonical upload method + deterministic method if still missing. */
function ensurePetServiceHasUploadPetImage(operationDetail) {
  ensureCanonicalUploadPetImageMethod(operationDetail);
  if (!isPostPetUploadImageOperation(operationDetail) || !fs.existsSync(PET_SERVICE)) {
    return;
  }
  const src = fs.readFileSync(PET_SERVICE, 'utf8');
  if (/uploadPetImage\s*\(/.test(src)) return;
  const backup = fs.readFileSync(PET_SERVICE, 'utf8');
  if (tryApplyDeterministicPetUploadImage(operationDetail)) {
    const c = mvnTestCompileResult();
    if (!c.ok) {
      logMvnFailure('Deterministic uploadPetImage insert failed compile.', c.log);
      fs.writeFileSync(PET_SERVICE, backup);
    } else {
      console.log('👉 Inserted deterministic PetService.uploadPetImage.');
    }
  }
}

async function syncPetServiceWithOllama(change, operationDetail) {
  if (String(process.env.OLLAMA_SYNC_SERVICE || '1') === '0') return;
  if (!operationDetail || !change.endpoint.includes('/pet')) return;
  if (!fs.existsSync(PET_SERVICE)) {
    console.warn('⚠️  PetService.java missing; skip service sync');
    return;
  }
  const { path: apiPath } = parseEndpoint(change.endpoint);
  let src = fs.readFileSync(PET_SERVICE, 'utf8');
  if (petServiceLikelyHasPath(src, apiPath)) {
    console.log(
      '👉 PetService already covers path literals; skipping Ollama service sync'
    );
    return;
  }
  console.log('👉 Ollama: updating PetService.java for this operation...');
  const prompt = `You are editing Java. Output ONLY the complete PetService.java file, no markdown.

Preserve every existing public static method unless you must fix a path string for the same operation.

Add or adjust ONE public static method returning io.restassured.response.Response for this OpenAPI operation (path template + method):
${JSON.stringify(operationDetail, null, 2)}

Rules:
- package services; public final class PetService; private PetService() {}
- Use given().spec(RequestSpecBuilderUtil.getPetstoreRequestSpec()) like existing methods.
- For multipart/form-data use ContentType.MULTIPART and multiPart(...) for each form field from the spec.
- Build URLs with string concat for path params (e.g. "/pet/" + petId + "/uploadImage").
- Required imports when using File / MULTIPART: import java.io.File; import io.restassured.http.ContentType;
Full current file:
${src}`;

  const backup = src;
  const raw = await callOllama(prompt);
  let next = stripMarkdownCodeFence(raw);
  if (!next.includes('package services')) {
    console.warn('⚠️  PetService sync output invalid; keeping previous file.');
    tryApplyDeterministicPetUploadImage(operationDetail);
    const c0 = mvnTestCompileResult();
    if (!c0.ok) {
      logMvnFailure('Deterministic PetService patch after invalid LLM output failed.', c0.log);
      fs.writeFileSync(PET_SERVICE, backup);
    }
    return;
  }
  fs.writeFileSync(PET_SERVICE, next);
  let compile = mvnTestCompileResult();
  if (compile.ok) {
    console.log('✅ PetService.java updated and compiles.');
    return;
  }
  logMvnFailure('mvn test-compile failed after PetService sync; reverting.', compile.log);
  fs.writeFileSync(PET_SERVICE, backup);
  if (tryApplyDeterministicPetUploadImage(operationDetail)) {
    const c2 = mvnTestCompileResult();
    if (c2.ok) {
      console.log('✅ Deterministic uploadPetImage applied; compiles.');
    } else {
      logMvnFailure('Deterministic PetService patch did not compile.', c2.log);
      fs.writeFileSync(PET_SERVICE, backup);
    }
  }
}

function getChanges() {
  const raw = fs.readFileSync(swaggerPaths.changes, 'utf8').trim();
  if (!raw) return [];
  return JSON.parse(raw);
}

function getSelectedEndpoints() {
  const swagger = JSON.parse(fs.readFileSync(swaggerPaths.spec, 'utf8'));
  const paths = swagger.paths;

  const selected = [];

  for (const target of TARGET_ENDPOINTS) {
    if (paths[target.path] && paths[target.path][target.method]) {
      selected.push({
        path: target.path,
        method: target.method,
        details: paths[target.path][target.method]
      });
    }
  }

  return selected;
}

function javaClassNameFromTestFile(filePath) {
  const seg = filePath.split(/[/\\]/).pop() || '';
  return seg.replace(/\.java$/i, '');
}

/** LLMs often rename classes from operationId (e.g. updatePet → UpdatePetTest); file must stay consistent. */
function enforcePublicClassName(javaSource, className) {
  if (!className) return javaSource;
  return javaSource.replace(
    /public\s+class\s+[A-Za-z0-9_]+/,
    `public class ${className}`
  );
}

/** If source uses Response type, ensure Rest Assured import (common LLM omission). */
function ensureResponseImport(javaSource) {
  if (!javaSource || !/\bResponse\b/.test(javaSource)) return javaSource;
  if (/import\s+io\.restassured\.response\.Response\s*;/.test(javaSource)) {
    return javaSource;
  }
  const line = 'import io.restassured.response.Response;\n';
  const firstImport = javaSource.indexOf('import ');
  if (firstImport !== -1) {
    return javaSource.slice(0, firstImport) + line + javaSource.slice(firstImport);
  }
  const semi = javaSource.indexOf(';');
  if (javaSource.startsWith('package ') && semi !== -1) {
    let j = semi + 1;
    while (j < javaSource.length && /\s/.test(javaSource[j])) j += 1;
    return `${javaSource.slice(0, j)}\n\n${line}${javaSource.slice(j)}`;
  }
  return line + javaSource;
}

function escapeRe(t) {
  return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Rewrites "PetService x = new PetService(); x.foo();" -> "PetService.foo();" (constructors are private).
 */
function sanitizeStaticServiceUsage(javaSource) {
  if (!javaSource) return javaSource;
  let s = javaSource;
  for (const Svc of ['PetService', 'UserService']) {
    const fq = `(?:services\\.)?${Svc}`;
    const declRe = new RegExp(
      `\\b${fq}\\s+(\\w+)\\s*=\\s*new\\s+${fq}\\s*\\(\\s*\\)\\s*;\\s*`
    );
    let match = declRe.exec(s);
    while (match) {
      const v = match[1];
      s = s.replace(new RegExp(`\\b${escapeRe(v)}\\.`, 'g'), `${Svc}.`);
      s = s.replace(declRe, '');
      match = declRe.exec(s);
    }
  }
  s = s.replace(/\bnew\s+(?:services\.)?PetService\s*\(\s*\)\s*;?/g, '');
  s = s.replace(/\bnew\s+(?:services\.)?UserService\s*\(\s*\)\s*;?/g, '');
  return s;
}

function createPrompt(
  change,
  existingCode = '',
  outputJavaPath = '',
  operationDetail = null,
  petServiceContext = ''
) {
  const renameHint = change.renameFromPath
    ? `Path migration: the API path was corrected from "${change.renameFromPath}" to "${change.endpoint.split('#')[0]}". Update service methods or .post()/.put()/.get() paths to use the new path; keep PetService/UserService encapsulation when possible. Keep the same public class name as the target file.\n\n`
    : '';

  const requiredClass = outputJavaPath ? javaClassNameFromTestFile(outputJavaPath) : '';
  const classRule = requiredClass
    ? `REQUIRED: The output file is \`${requiredClass}.java\`. The one public class MUST be named exactly \`${requiredClass}\`. Do not rename it to match operationId, summary, or endpoint text (e.g. never use UpdatePetTest for this file).\n\n`
    : '';

  const openApiBlock = operationDetail
    ? `OpenAPI operation (authoritative — use real paths, methods, requestBody, parameters, consumes):\n${JSON.stringify(operationDetail, null, 2)}\n\n`
    : '';

  const serviceBlock = petServiceContext
    ? `Current PetService.java (call ONLY these static method signatures; do not invent builders):\n${petServiceContext}\n\n`
    : '';

  return `
You are a senior QA Automation Engineer.

Follow the repository Java test framework below exactly. Prefer extending services (PetService, UserService) or calling them from tests; do not hardcode base URLs or API keys.

--- FRAMEWORK (mandatory) ---
${FRAMEWORK_INSTRUCTIONS}
--- END FRAMEWORK ---

--- STRICT TEST RULES ---
${STRICT_GENERATED_TEST_RULES}
--- END STRICT ---

${classRule}${renameHint}${openApiBlock}${serviceBlock}Swagger Change:
Endpoint: ${change.endpoint}
Type: ${change.type}
Category: ${change.category}
${change.operationId ? `operationId: ${change.operationId} (do not use this to name the Java class)\n` : ''}

${existingCode ? `Existing Test:\n${existingCode}` : ''}

Task:
- PetService / UserService: use ONLY static calls on the class name (e.g. PetService.getPet(1L)). Never instantiate services.
- If NEW (and no rename hint) → create full test for this method only (package tests; use services + ResponseValidator + models as per FRAMEWORK).
- If UPDATED → modify only affected parts; keep framework layering.
- If DELETED → suggest removal
- If rename hint is present → minimally edit paths or service methods; do not add unrelated operations

Return ONLY Java source code (one file). No markdown fences unless wrapping a single java block is unavoidable—we strip fences downstream.
`;
}

function stripMarkdownCodeFence(text) {
  let s = text.trim();
  const open = s.match(/^```(?:java)?\s*\n?/i);
  if (open) s = s.slice(open[0].length);
  if (s.endsWith('```')) s = s.slice(0, -3).trimEnd();
  const idx = s.search(/\n```(?:\s*\n|$)/);
  if (idx !== -1) s = s.slice(0, idx).trimEnd();
  return s.trim();
}

function getJavaFileNameFromChange(change) {
  const [path, methodPart = "unknown"] = change.endpoint.split('#');
  const method = methodPart.split('|')[0];

  const name =
    method.charAt(0).toUpperCase() +
    method.slice(1) +
    path.replace(/[\/{}]/g, '');

  return `java-tests/src/test/java/tests/${name}Test.java`;
}

function parseEndpoint(endpoint) {
  const [path, methodPart = "unknown"] = endpoint.split('#');
  return {
    path,
    method: methodPart.split('|')[0]
  };
}

async function callOllama(prompt) {
  const response = await axios.post(OLLAMA_URL, {
    model: MODEL,
    prompt: prompt,
    stream: false,
    options: {
      temperature: Number(process.env.OLLAMA_TEMPERATURE) || 0.2
    }
  });

  return response.data.response;
}

async function run() {
  const changes = getChanges();
  const pendingDeletedEndpointChanges = changes.filter(
    (c) => c.category === 'ENDPOINT_CHANGE' && c.type === 'DELETED'
  );

  for (const change of changes) {
    console.log(`Processing: ${change.endpoint} (${change.category})`);

    let fileName = getJavaFileNameFromChange(change);

    // Hold endpoint deletions until we know whether a NEW endpoint should reuse them.
    if (change.category === 'ENDPOINT_CHANGE' && change.type === 'DELETED') {
      console.log('👉 Holding deleted endpoint for possible reuse');
      continue;
    }

    // Other deleted APIs should not generate a new test.
    if (change.type === 'DELETED') {
      if (fs.existsSync(fileName)) {
        fs.unlinkSync(fileName);
        console.log(`🗑️ Removed test for deleted endpoint: ${fileName}\n`);
      } else {
        console.log('👉 Endpoint deleted; no existing test file to remove');
      }
      continue;
    }

    let existingCode = '';

    // Pair NEW with DELETED same HTTP method (path rename in spec): reuse old file if present, else same target file + rename hint.
    let reusedDeletedFile = false;
    let renameFromPath;
    if (change.category === 'ENDPOINT_CHANGE' && change.type === 'NEW') {
      const current = parseEndpoint(change.endpoint);
      const matchIdx = pendingDeletedEndpointChanges.findIndex((d) => {
        const candidate = parseEndpoint(d.endpoint);
        return candidate.method === current.method;
      });

      if (matchIdx !== -1) {
        const deletedMatch = pendingDeletedEndpointChanges.splice(matchIdx, 1)[0];
        const candidateFile = getJavaFileNameFromChange(deletedMatch);
        const oldPath = parseEndpoint(deletedMatch.endpoint).path;
        if (fs.existsSync(candidateFile)) {
          fileName = candidateFile;
          reusedDeletedFile = true;
          console.log(`👉 Reusing existing test file: ${fileName}`);
        } else {
          renameFromPath = oldPath;
          console.log(
            `👉 Rename ${oldPath} → ${current.path} (${current.method}); updating ${fileName}`
          );
        }
      }
    }

    if (fs.existsSync(fileName)) {
      existingCode = fs.readFileSync(fileName, 'utf-8');
    }

    switch (change.category) {
      case 'ENDPOINT_CHANGE':
      case 'URL_CHANGE':
        if (existingCode || reusedDeletedFile) {
          console.log('👉 Endpoint change → update existing test');
        } else {
          console.log('👉 New API → generate test');
        }
        break;

      case 'BODY_CHANGE':
      case 'QUERY_PARAM_CHANGE':
      case 'PATH_PARAM_CHANGE':
      case 'RESPONSE_CHANGE':
        console.log('👉 Update existing test');
        break;

      default:
        console.log('👉 Skipping minor change');
        continue;
    }

    const spec = loadOpenApiSpec();
    const operationDetail = spec ? getOperationFromChange(spec, change) : null;
    if (!operationDetail) {
      console.warn(
        `⚠️  No matching OpenAPI path/method in spec for ${change.endpoint}; Ollama may hallucinate. Check ${swaggerPaths.spec}.`
      );
    }

    await syncPetServiceWithOllama(
      change,
      operationDetail
    );
    ensurePetServiceHasUploadPetImage(operationDetail);

    let petServiceSnippet = '';
    if (fs.existsSync(PET_SERVICE) && change.endpoint.includes('/pet')) {
      petServiceSnippet = fs.readFileSync(PET_SERVICE, 'utf8');
    }

    const prompt = createPrompt(
      renameFromPath ? { ...change, renameFromPath } : change,
      existingCode,
      fileName,
      operationDetail,
      petServiceSnippet
    );
    const raw = await callOllama(prompt);
    const stripped = stripMarkdownCodeFence(raw);
    const requiredClass = javaClassNameFromTestFile(fileName);
    let result = sanitizeStaticServiceUsage(
      ensureResponseImport(enforcePublicClassName(stripped, requiredClass))
    );

    const maxFix = Math.max(1, Number(process.env.OLLAMA_FIX_ATTEMPTS || '3'));
    let lastCompile = { ok: true, log: '' };
    for (let attempt = 0; attempt < maxFix; attempt += 1) {
      fs.writeFileSync(fileName, result);
      lastCompile = mvnTestCompileResult();
      if (lastCompile.ok) break;
      logMvnFailure(
        `mvn test-compile failed for ${fileName} (attempt ${attempt + 1}/${maxFix})`,
        lastCompile.log
      );
      if (attempt < maxFix - 1) {
        const fixPrompt = `You fix a Java TestNG test. Output ONLY the complete fixed .java file, no markdown.

${STRICT_GENERATED_TEST_RULES}

- Prefer models.TestDataBuilder for pet bodies — NEVER Pet.builder(); Pet.photoUrls is java.util.List<String> not String[].
- import io.restassured.response.Response when using Response; import java.io.File when using File.
- PetService/UserService: ONLY static methods — NEVER "new PetService()" or a local variable like petService.createPet(); use PetService.createPet(...) etc.
- Call the matching static method on PetService as it appears in the current PetService.java (see initial prompt).

Compiler output:
${lastCompile.log.slice(-12000)}

--- File to fix ---
${result}`;
        const fixedRaw = await callOllama(fixPrompt);
        result = sanitizeStaticServiceUsage(
          ensureResponseImport(
            enforcePublicClassName(stripMarkdownCodeFence(fixedRaw), requiredClass)
          )
        );
      }
    }

    if (!lastCompile.ok) {
      console.warn(
        `⚠️  Test still does not compile after ${maxFix} attempt(s). Set OLLAMA_MODEL to a larger model or fix ${fileName} manually.`
      );
    }

    console.log(`✅ Updated: ${fileName}\n`);
  }

  // Cleanup unmatched deleted endpoint tests.
  for (const deletedChange of pendingDeletedEndpointChanges) {
    const staleFile = getJavaFileNameFromChange(deletedChange);
    if (fs.existsSync(staleFile)) {
      fs.unlinkSync(staleFile);
      console.log(`🗑️ Removed stale endpoint test: ${staleFile}`);
    }
  }

  console.log('AI-based test update completed 🚀');
}

run();
