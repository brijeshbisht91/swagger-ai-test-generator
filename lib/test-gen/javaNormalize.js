'use strict';

function javaClassNameFromTestFile(filePath) {
  const seg = filePath.split(/[/\\]/).pop() || '';
  return seg.replace(/\.java$/i, '');
}

function enforcePublicClassName(javaSource, className) {
  if (!className) return javaSource;
  return javaSource.replace(
    /public\s+class\s+[A-Za-z0-9_]+/,
    `public class ${className}`
  );
}

function ensureResponseImport(javaSource) {
  if (!javaSource || !/\bResponse\b/.test(javaSource)) return javaSource;
  if (/import\s+io\.restassured\.response\.Response\s*;/.test(javaSource)) {
    return javaSource;
  }
  const line = 'import io.restassured.response.Response;\n';
  const firstImport = javaSource.indexOf('import ');
  if (firstImport !== -1) {
    return javaSource.slice(0, firstImport) + line + javaSource.slice(firstImport);
  }
  const semi = javaSource.indexOf(';');
  if (javaSource.startsWith('package ') && semi !== -1) {
    let j = semi + 1;
    while (j < javaSource.length && /\s/.test(javaSource[j])) j += 1;
    return `${javaSource.slice(0, j)}\n\n${line}${javaSource.slice(j)}`;
  }
  return line + javaSource;
}

function escapeRe(t) {
  return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeStaticServiceUsage(javaSource) {
  if (!javaSource) return javaSource;
  let s = javaSource;
  for (const Svc of ['PetService', 'UserService']) {
    const fq = `(?:services\\.)?${Svc}`;
    const declRe = new RegExp(
      `\\b${fq}\\s+(\\w+)\\s*=\\s*new\\s+${fq}\\s*\\(\\s*\\)\\s*;\\s*`
    );
    let match = declRe.exec(s);
    while (match) {
      const v = match[1];
      s = s.replace(new RegExp(`\\b${escapeRe(v)}\\.`, 'g'), `${Svc}.`);
      s = s.replace(declRe, '');
      match = declRe.exec(s);
    }
  }
  s = s.replace(/\bnew\s+(?:services\.)?PetService\s*\(\s*\)\s*;?/g, '');
  s = s.replace(/\bnew\s+(?:services\.)?UserService\s*\(\s*\)\s*;?/g, '');
  return s;
}

function ensureCommonFrameworkImports(javaSource) {
  if (!javaSource) return javaSource;
  const toAdd = [];
  if (
    /\bTestDataBuilder\b/.test(javaSource) &&
    !/import\s+models\.TestDataBuilder\s*;/.test(javaSource)
  ) {
    toAdd.push('import models.TestDataBuilder;\n');
  }
  if (
    /\bFiles\./.test(javaSource) &&
    !/import\s+java\.nio\.file\.Files\s*;/.test(javaSource)
  ) {
    toAdd.push('import java.nio.file.Files;\n');
  }
  const usesFileType =
    /\bnew\s+File\s*\(/.test(javaSource) ||
    /\bFile\.createTempFile/.test(javaSource) ||
    /(?:^|[\s(;])File\s+\w+/.test(javaSource);
  if (usesFileType && !/import\s+java\.io\.File\s*;/.test(javaSource)) {
    toAdd.push('import java.io.File;\n');
  }
  if (
    /\bIOException\b/.test(javaSource) &&
    !/import\s+java\.io\.IOException\s*;/.test(javaSource)
  ) {
    toAdd.push('import java.io.IOException;\n');
  }
  if (!toAdd.length) return javaSource;
  const block = toAdd.join('');
  const firstImport = javaSource.indexOf('import ');
  if (firstImport !== -1) {
    return (
      javaSource.slice(0, firstImport) + block + javaSource.slice(firstImport)
    );
  }
  const semi = javaSource.indexOf(';');
  if (javaSource.startsWith('package ') && semi !== -1) {
    let j = semi + 1;
    while (j < javaSource.length && /\s/.test(javaSource[j])) j += 1;
    return `${javaSource.slice(0, j)}\n\n${block}${javaSource.slice(j)}`;
  }
  return block + javaSource;
}

function normalizeGeneratedTest(javaSource, requiredClass) {
  return sanitizeStaticServiceUsage(
    ensureCommonFrameworkImports(
      ensureResponseImport(enforcePublicClassName(javaSource, requiredClass))
    )
  );
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

module.exports = {
  javaClassNameFromTestFile,
  enforcePublicClassName,
  ensureResponseImport,
  escapeRe,
  sanitizeStaticServiceUsage,
  ensureCommonFrameworkImports,
  normalizeGeneratedTest,
  stripMarkdownCodeFence
};
