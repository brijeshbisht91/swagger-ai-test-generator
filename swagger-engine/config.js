/**
 * Single place for Swagger change-detection engine paths (inputs/outputs).
 * Override with SWAGGER_ENGINE_DIR if the engine lives outside the default folder.
 */
const path = require('path');

const ENGINE_ROOT = process.env.SWAGGER_ENGINE_DIR
  ? path.resolve(process.env.SWAGGER_ENGINE_DIR)
  : __dirname;

const paths = {
  latest: path.join(ENGINE_ROOT, 'swagger-latest.json'),
  prev: path.join(ENGINE_ROOT, 'swagger-prev.json'),
  diff: path.join(ENGINE_ROOT, 'swagger-diff.json'),
  changes: path.join(ENGINE_ROOT, 'swagger-changes.json'),
  /** Current API document (same as latest after fetch) */
  spec: path.join(ENGINE_ROOT, 'swagger-latest.json'),
  securityReportJson: path.join(ENGINE_ROOT, 'security-report.json'),
  securityReportMd: path.join(ENGINE_ROOT, 'security-report.md'),
};

/** Shared Ollama HTTP settings (same defaults as app.js). */
function getOllamaConfig() {
  const base = (process.env.OLLAMA_HOST || 'http://localhost:11434').replace(
    /\/$/,
    ''
  );
  return {
    baseUrl: base,
    generateUrl: `${base}/api/generate`,
    model: process.env.OLLAMA_MODEL || 'llama3.2:3b',
  };
}

module.exports = { ENGINE_ROOT, paths, getOllamaConfig };
