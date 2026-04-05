const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { paths: swaggerPaths } = require('./swagger-engine/config');

const { parseEndpoint, getJavaFileNameFromChange } = require('./lib/test-gen/swaggerChange');
const { mvnTestCompileResult, logMvnFailure } = require('./lib/test-gen/maven');
const {
  javaClassNameFromTestFile,
  normalizeGeneratedTest,
  stripMarkdownCodeFence
} = require('./lib/test-gen/javaNormalize');
const { loadOpenApiSpec, getOperationFromChange } = require('./lib/test-gen/openapiHelpers');
const {
  STRICT_GENERATED_TEST_RULES,
  loadFrameworkInstructions,
  createTestPrompt,
  buildCompileFixPrompt
} = require('./lib/test-gen/framework');
const {
  syncPetServiceWithOllama,
  ensurePetServiceHasUploadPetImage
} = require('./lib/test-gen/petServiceSync');

const JAVA_TESTS = path.join(__dirname, 'java-tests');
const PET_SERVICE = path.join(
  JAVA_TESTS,
  'src/test/java/services/PetService.java'
);
const FRAMEWORK_DOC_PATH = path.join(__dirname, 'docs', 'FRAMEWORK.md');

const OLLAMA_BASE = (process.env.OLLAMA_HOST || 'http://localhost:11434').replace(
  /\/$/,
  ''
);
const OLLAMA_URL = `${OLLAMA_BASE}/api/generate`;
const MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';

const FRAMEWORK_INSTRUCTIONS = loadFrameworkInstructions(FRAMEWORK_DOC_PATH);

/** Reserved for future targeted generation; empty = unused. */
const TARGET_ENDPOINTS = [];

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

    if (change.category === 'ENDPOINT_CHANGE' && change.type === 'DELETED') {
      console.log('👉 Holding deleted endpoint for possible reuse');
      continue;
    }

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

    const spec = loadOpenApiSpec(swaggerPaths.spec);
    const operationDetail = spec ? getOperationFromChange(spec, change) : null;
    if (!operationDetail) {
      console.warn(
        `⚠️  No matching OpenAPI path/method in spec for ${change.endpoint}; Ollama may hallucinate. Check ${swaggerPaths.spec}.`
      );
    }

    await syncPetServiceWithOllama({
      change,
      operationDetail,
      petServicePath: PET_SERVICE,
      javaTestsCwd: JAVA_TESTS,
      callOllama
    });
    ensurePetServiceHasUploadPetImage(
      operationDetail,
      PET_SERVICE,
      JAVA_TESTS
    );

    let petServiceSnippet = '';
    if (fs.existsSync(PET_SERVICE) && change.endpoint.includes('/pet')) {
      petServiceSnippet = fs.readFileSync(PET_SERVICE, 'utf8');
    }

    const prompt = createTestPrompt({
      change: renameFromPath ? { ...change, renameFromPath } : change,
      existingCode,
      outputJavaPath: fileName,
      operationDetail,
      petServiceContext: petServiceSnippet,
      frameworkInstructions: FRAMEWORK_INSTRUCTIONS
    });

    const raw = await callOllama(prompt);
    const stripped = stripMarkdownCodeFence(raw);
    const requiredClass = javaClassNameFromTestFile(fileName);
    let result = normalizeGeneratedTest(stripped, requiredClass);

    const maxFix = Math.max(1, Number(process.env.OLLAMA_FIX_ATTEMPTS || '3'));
    let lastCompile = { ok: true, log: '' };
    for (let attempt = 0; attempt < maxFix; attempt += 1) {
      fs.writeFileSync(fileName, result);
      lastCompile = mvnTestCompileResult(JAVA_TESTS);
      if (lastCompile.ok) break;
      logMvnFailure(
        `mvn test-compile failed for ${fileName} (attempt ${attempt + 1}/${maxFix})`,
        lastCompile.log
      );
      if (attempt < maxFix - 1) {
        let petServiceJava = '';
        if (change.endpoint.includes('/pet') && fs.existsSync(PET_SERVICE)) {
          petServiceJava = fs.readFileSync(PET_SERVICE, 'utf8');
        }
        const fixPrompt = buildCompileFixPrompt({
          strictRules: STRICT_GENERATED_TEST_RULES,
          petServiceJava,
          compileLog: lastCompile.log,
          brokenSource: result
        });
        const fixedRaw = await callOllama(fixPrompt);
        result = normalizeGeneratedTest(
          stripMarkdownCodeFence(fixedRaw),
          requiredClass
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
