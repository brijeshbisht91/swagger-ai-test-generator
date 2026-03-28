const fs = require('fs');
const path = require('path');
const diff = require('deep-diff').diff;
const { analyzeChanges } = require('./analyzeDiff');
const { ENGINE_ROOT, paths } = require('./config');

const oldSwagger = JSON.parse(fs.readFileSync(paths.prev, 'utf8'));
const newSwagger = JSON.parse(fs.readFileSync(paths.latest, 'utf8'));

const differences = diff(oldSwagger.paths, newSwagger.paths);

const analyzedChanges = analyzeChanges(differences || []);

const diffJson = JSON.stringify(
  differences != null ? differences : [],
  null,
  2
);
const changesJson = JSON.stringify(analyzedChanges, null, 2);

fs.writeFileSync(paths.diff, diffJson, 'utf8');
fs.writeFileSync(paths.changes, changesJson, 'utf8');

const absDiff = path.resolve(paths.diff);
const absChanges = path.resolve(paths.changes);
console.log(`swagger-engine root: ${path.resolve(ENGINE_ROOT)}`);
if (process.env.SWAGGER_ENGINE_DIR) {
  console.log(`(SWAGGER_ENGINE_DIR overrides engine root — outputs go there, not necessarily this repo copy)`);
}
console.log(`Wrote swagger-diff (${diffJson.length} bytes): ${absDiff}`);
console.log(
  `Wrote swagger-changes: ${analyzedChanges.length} row(s), ${changesJson.length} bytes -> ${absChanges}`
);
