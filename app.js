const fs = require('fs');
const axios = require('axios');

const OLLAMA_BASE = (process.env.OLLAMA_HOST || 'http://localhost:11434').replace(
  /\/$/,
  ''
);
const OLLAMA_URL = `${OLLAMA_BASE}/api/generate`;
const MODEL = 'llama3.2:3b';

function getChanges() {
  return JSON.parse(fs.readFileSync('swagger-changes.json'));
}

function getSelectedEndpoints() {
  const swagger = JSON.parse(fs.readFileSync('swagger.json'));
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

function createPrompt(change, existingCode = "") {
  return `
You are a senior QA Automation Engineer.

Swagger Change:
Endpoint: ${change.endpoint}
Type: ${change.type}
Category: ${change.category}

${existingCode ? `Existing Test:\n${existingCode}` : ""}

Task:
- If NEW → create full test
- If UPDATED → modify only affected parts
- If DELETED → suggest removal

Use:
- TestNG
- Rest Assured
- Extend base.BaseTest

Return ONLY Java code.
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
    stream: false
  });

  return response.data.response;
}

async function run() {
  const changes = getChanges();
  const pendingDeletedEndpointChanges = changes.filter(
    (c) => c.category === "ENDPOINT_CHANGE" && c.type === "DELETED"
  );

  for (const change of changes) {
    console.log(`Processing: ${change.endpoint} (${change.category})`);

    let fileName = getJavaFileNameFromChange(change);

    // Hold endpoint deletions until we know whether a NEW endpoint should reuse them.
    if (change.category === "ENDPOINT_CHANGE" && change.type === "DELETED") {
      console.log("👉 Holding deleted endpoint for possible reuse");
      continue;
    }

    // Other deleted APIs should not generate a new test.
    if (change.type === "DELETED") {
      if (fs.existsSync(fileName)) {
        fs.unlinkSync(fileName);
        console.log(`🗑️ Removed test for deleted endpoint: ${fileName}\n`);
      } else {
        console.log("👉 Endpoint deleted; no existing test file to remove");
      }
      continue;
    }

    let existingCode = "";

    // For endpoint rename style diffs (DELETED + NEW), reuse old file when possible.
    let reusedDeletedFile = false;
    if (change.category === "ENDPOINT_CHANGE" && change.type === "NEW") {
      const current = parseEndpoint(change.endpoint);
      const matchIdx = pendingDeletedEndpointChanges.findIndex((d) => {
        const candidate = parseEndpoint(d.endpoint);
        if (candidate.method !== current.method) return false;
        const candidateFile = getJavaFileNameFromChange(d);
        return fs.existsSync(candidateFile);
      });

      if (matchIdx !== -1) {
        const deletedMatch = pendingDeletedEndpointChanges.splice(matchIdx, 1)[0];
        fileName = getJavaFileNameFromChange(deletedMatch);
        reusedDeletedFile = true;
        console.log(`👉 Reusing existing test file: ${fileName}`);
      }
    }

    if (fs.existsSync(fileName)) {
      existingCode = fs.readFileSync(fileName, 'utf-8');
    }

    switch (change.category) {

      case "ENDPOINT_CHANGE":
      case "URL_CHANGE":
        if (existingCode || reusedDeletedFile) {
          console.log("👉 Endpoint change → update existing test");
        } else {
          console.log("👉 New API → generate test");
        }
        break;

      case "BODY_CHANGE":
      case "QUERY_PARAM_CHANGE":
      case "PATH_PARAM_CHANGE":
      case "RESPONSE_CHANGE":
        console.log("👉 Update existing test");
        break;

      default:
        console.log("👉 Skipping minor change");
        continue;
    }

    const prompt = createPrompt(change, existingCode);
    const raw = await callOllama(prompt);
    const result = stripMarkdownCodeFence(raw);

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

  console.log("AI-based test update completed 🚀");
}

run();