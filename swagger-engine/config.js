/**
 * Single place for Swagger engine paths (inputs/outputs).
 * Override with SWAGGER_ENGINE_DIR if the engine root lives elsewhere.
 *
 * Layout:
 *   specs/     — OpenAPI snapshots + diff artifacts (swagger-*.json)
 *   reports/   — security scan outputs
 *   fetch/     — fetch script
 *   diff/      — diff + analyze scripts
 *   security/  — security scan + Ollama + live probe
 */
const path = require('path');

const ENGINE_ROOT = process.env.SWAGGER_ENGINE_DIR
  ? path.resolve(process.env.SWAGGER_ENGINE_DIR)
  : __dirname;

const SPECS_DIR = path.join(ENGINE_ROOT, 'specs');
const REPORTS_DIR = path.join(ENGINE_ROOT, 'reports');

const paths = {
  latest: path.join(SPECS_DIR, 'swagger-latest.json'),
  prev: path.join(SPECS_DIR, 'swagger-prev.json'),
  diff: path.join(SPECS_DIR, 'swagger-diff.json'),
  changes: path.join(SPECS_DIR, 'swagger-changes.json'),
  /** Current API document (same as latest after fetch) */
  spec: path.join(SPECS_DIR, 'swagger-latest.json'),
  securityReportJson: path.join(REPORTS_DIR, 'security-report.json'),
  securityReportMd: path.join(REPORTS_DIR, 'security-report.md'),
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

module.exports = { ENGINE_ROOT, SPECS_DIR, REPORTS_DIR, paths, getOllamaConfig };
