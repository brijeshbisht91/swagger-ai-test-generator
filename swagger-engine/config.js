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
};

module.exports = { ENGINE_ROOT, paths };
