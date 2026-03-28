const fs = require('fs');
const diff = require('deep-diff').diff;
const { analyzeChanges } = require('./analyzeDiff');
const { paths } = require('./config');

const oldSwagger = JSON.parse(fs.readFileSync(paths.prev, 'utf8'));
const newSwagger = JSON.parse(fs.readFileSync(paths.latest, 'utf8'));

const differences = diff(oldSwagger.paths, newSwagger.paths);

const analyzedChanges = analyzeChanges(differences || []);

fs.writeFileSync(paths.diff, JSON.stringify(differences, null, 2));
fs.writeFileSync(paths.changes, JSON.stringify(analyzedChanges, null, 2));

console.log(`Created ${paths.diff}`);
console.log(`Created ${paths.changes}`);
