'use strict';

const { execSync } = require('child_process');

function mvnTestCompileResult(javaTestsCwd) {
  try {
    const out = execSync('mvn -e -B test-compile', {
      cwd: javaTestsCwd,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024
    });
    return { ok: true, log: out || '' };
  } catch (e) {
    const log =
      [e.stdout || '', e.stderr || ''].join('\n').trim() ||
      String(e.message || '');
    return { ok: false, log };
  }
}

function logMvnFailure(title, log) {
  console.warn(`⚠️  ${title}`);
  const text = (log || '').trim();
  const tail = text.length > 8000 ? text.slice(-8000) : text;
  console.warn(tail || '(no compiler output captured)');
}

module.exports = {
  mvnTestCompileResult,
  logMvnFailure
};
