const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { paths: swaggerPaths } = require('./swagger-engine/config');

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

function createPrompt(change, existingCode = '', outputJavaPath = '') {
  const renameHint = change.renameFromPath
    ? `Path migration: the API path was corrected from "${change.renameFromPath}" to "${change.endpoint.split('#')[0]}". Update service methods or .post()/.put()/.get() paths to use the new path; keep PetService/UserService encapsulation when possible. Keep the same public class name as the target file.\n\n`
    : '';

  const requiredClass = outputJavaPath ? javaClassNameFromTestFile(outputJavaPath) : '';
  const classRule = requiredClass
    ? `REQUIRED: The output file is \`${requiredClass}.java\`. The one public class MUST be named exactly \`${requiredClass}\`. Do not rename it to match operationId, summary, or endpoint text (e.g. never use UpdatePetTest for this file).\n\n`
    : '';

  return `
You are a senior QA Automation Engineer.

Follow the repository Java test framework below exactly. Prefer extending services (PetService, UserService) or calling them from tests; do not hardcode base URLs or API keys.

--- FRAMEWORK (mandatory) ---
${FRAMEWORK_INSTRUCTIONS}
--- END FRAMEWORK ---

${classRule}${renameHint}Swagger Change:
Endpoint: ${change.endpoint}
Type: ${change.type}
Category: ${change.category}
${change.operationId ? `operationId: ${change.operationId} (do not use this to name the Java class)\n` : ''}

${existingCode ? `Existing Test:\n${existingCode}` : ''}

Task:
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

    const prompt = createPrompt(
      renameFromPath ? { ...change, renameFromPath } : change,
      existingCode,
      fileName
    );
    const raw = await callOllama(prompt);
    const stripped = stripMarkdownCodeFence(raw);
    const requiredClass = javaClassNameFromTestFile(fileName);
    const result = enforcePublicClassName(stripped, requiredClass);

    fs.writeFileSync(fileName, result);

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
