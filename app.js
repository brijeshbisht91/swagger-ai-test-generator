const fs = require('fs');
const axios = require('axios');

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL = 'llama3.2:3b';

const TARGET_ENDPOINTS = [
  { path: "/pet", method: "post" },
  { path: "/pet/{petId}", method: "get" },
  { path: "/pet", method: "put" },
  { path: "/pet/{petId}", method: "delete" }
];

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

function createPrompt(endpoint) {
  return `
You are a senior QA Automation Engineer.

Generate a complete Java TestNG test class using Rest Assured.

Requirements:
- Use TestNG
- Include package: tests
- Class name based on endpoint
- Use the public Swagger Petstore v2 base URI https://petstore.swagger.io/v2 (paths relative: /pet, /pet/{id}, etc.).
- Extend base.BaseTest and add: import base.BaseTest;
- Include:
  - @Test method
  - Valid request body (if POST/PUT)
  - Assertions

API:
Endpoint: ${endpoint.path}
Method: ${endpoint.method.toUpperCase()}

Return ONLY Java code. Do not use markdown code fences (no \`\`\` or \`\`\`java).
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

function getJavaFileName(endpoint) {
  const name =
    endpoint.method.charAt(0).toUpperCase() +
    endpoint.method.slice(1) +
    endpoint.path.replace(/[\/{}]/g, '');

  return `java-tests/src/test/java/tests/${name}Test.java`;
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
  const endpoints = getSelectedEndpoints();

  for (const endpoint of endpoints) {
    console.log(`Generating for: ${endpoint.method.toUpperCase()} ${endpoint.path}`);

    const prompt = createPrompt(endpoint);
    const raw = await callOllama(prompt);
    const result = stripMarkdownCodeFence(raw);

    const fileName = getJavaFileName(endpoint);
    fs.writeFileSync(fileName, result);

    console.log(`Saved: ${fileName}\n`);
  }

  console.log("4 endpoint test generation done ✅");
}

run();