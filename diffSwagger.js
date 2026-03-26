const fs = require('fs');
const diff = require('deep-diff').diff;
const { analyzeChanges } = require('./analyzeDiff');

const oldSwagger = JSON.parse(fs.readFileSync('swagger-prev.json'));
const newSwagger = JSON.parse(fs.readFileSync('swagger-latest.json')); // latest

const differences = diff(oldSwagger.paths, newSwagger.paths);

// 🔥 IMPORTANT LINE
const analyzedChanges = analyzeChanges(differences);

// save both files
fs.writeFileSync('swagger-diff.json', JSON.stringify(differences, null, 2));
fs.writeFileSync('swagger-changes.json', JSON.stringify(analyzedChanges, null, 2));

console.log("✅ swagger-diff.json created");
console.log("✅ swagger-changes.json created");