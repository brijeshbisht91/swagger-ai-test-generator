const fs = require('fs');
const path = require('path');
const { paths, getOllamaConfig } = require('./config');
const { runLiveProbes } = require('./liveProbe');
const { runSecurityOllama } = require('./securityOllama');

const SPEC_EXCERPT_MAX = 90000;

function buildSpecExcerpt(spec) {
  const slim = {
    swagger: spec.swagger,
    openapi: spec.openapi,
    info: spec.info,
    host: spec.host,
    basePath: spec.basePath,
    schemes: spec.schemes,
    consumes: spec.consumes,
    produces: spec.produces,
    securityDefinitions: spec.securityDefinitions,
    security: spec.security,
    paths: spec.paths,
    definitions: spec.definitions,
  };
  let s = JSON.stringify(slim);
  if (s.length > SPEC_EXCERPT_MAX) {
    s =
      s.slice(0, SPEC_EXCERPT_MAX) +
      '\n…[OpenAPI JSON truncated; paths/securityDefinitions prioritized in excerpt]';
  }
  return s;
}

function flattenOllamaFindings(data) {
  const rows = [];
  if (!data || !Array.isArray(data.endpoints)) return rows;
  for (const ep of data.endpoints) {
    for (const iss of ep.issues || []) {
      rows.push({
        path: ep.path,
        method: ep.method,
        owaspId: iss.owaspId,
        owaspName: iss.owaspName,
        severity: iss.severity,
        description: iss.description,
        remediation: iss.remediation,
        evidence: iss.evidenceFromSpecOrProbes,
        source: 'ollama_owasp',
      });
    }
  }
  return rows;
}

function buildMarkdown(report) {
  const lines = [];
  lines.push('# API security report (OWASP API Top 10 via Ollama)');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push(
    `**Methodology:** ${report.methodology}`
  );
  lines.push('');
  lines.push(
    'Reference: [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)'
  );
  lines.push('');

  if (report.baseUrl) {
    lines.push(`Live probe base URL: \`${report.baseUrl}\``);
  } else {
    lines.push('Live probing: **skipped** (set `API_BASE_URL` to include HTTP facts).');
  }
  lines.push('');

  const summary =
    report.llm && report.llm.ok && report.llm.data && report.llm.data.executiveSummary
      ? report.llm.data.executiveSummary
      : report.llm && report.llm.error
        ? `Ollama analysis failed: ${report.llm.error}. No automated OWASP findings in this run.`
        : report.scanError
          ? `Scan did not complete successfully. See "Scan error" below.`
          : 'No executive summary (Ollama returned no summary — check JSON llm.raw if present).';
  lines.push('## Executive summary');
  lines.push('');
  lines.push(summary);
  lines.push('');

  if (report.scanError) {
    lines.push('## Scan error');
    lines.push('');
    lines.push(`\`${String(report.scanError).replace(/`/g, "'")}\``);
    lines.push('');
  }
  if (report.liveProbe && report.liveProbe.scanWarning) {
    lines.push('## Live probe warning');
    lines.push('');
    lines.push(String(report.liveProbe.scanWarning));
    lines.push('');
  }

  lines.push('## OWASP-oriented findings (flattened)');
  lines.push('');
  lines.push(
    '| OWASP | Method | Path | Severity | Description (short) |'
  );
  lines.push('|-------|--------|------|----------|---------------------|');

  for (const f of report.findings || []) {
    const esc = (s) => String(s || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
    const short = (f.description || '').slice(0, 100);
    lines.push(
      `| ${esc(f.owaspId)} | ${esc(f.method)} | ${esc(f.path)} | ${esc(f.severity)} | ${esc(short)} |`
    );
  }
  if (!(report.findings && report.findings.length)) {
    lines.push('| — | — | — | — | _No rows (LLM failed or reported no issues)._ |');
  }
  lines.push('');

  if (report.llm && report.llm.ok && report.llm.data && report.llm.data.endpoints) {
    lines.push('## By endpoint (detail)');
    lines.push('');
    for (const ep of report.llm.data.endpoints) {
      lines.push(`### ${String(ep.method || '*').toUpperCase()} \`${ep.path}\``);
      const issues = ep.issues || [];
      if (!issues.length) {
        lines.push('_No issues listed._');
        lines.push('');
        continue;
      }
      for (const iss of issues) {
        lines.push(
          `- **${iss.owaspId || '?'}** (${iss.owaspName || 'OWASP'}): **${iss.severity || 'n/a'}** — ${iss.description || ''}`
        );
        if (iss.evidenceFromSpecOrProbes) {
          lines.push(`  - *Evidence:* ${iss.evidenceFromSpecOrProbes}`);
        }
        if (iss.remediation) {
          lines.push(`  - *Remediation:* ${iss.remediation}`);
        }
      }
      lines.push('');
    }
  }

  const raw = report.llm && report.llm.raw;
  if (raw && (!(report.findings && report.findings.length) || !report.llm.ok)) {
    lines.push('## Raw model output (debug)');
    lines.push('');
    lines.push('```');
    lines.push(String(raw).slice(0, 4000));
    if (String(raw).length > 4000) lines.push('\n…(truncated)');
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

function writeReportBundle(report) {
  const jsonPath = path.resolve(paths.securityReportJson);
  const mdPath = path.resolve(paths.securityReportMd);
  let md;
  try {
    md = buildMarkdown(report);
  } catch (e) {
    md = `# API security report\n\n**Markdown generation failed:** ${e.message}\n\nOpen \`security-report.json\` in the same folder for details.\n`;
  }
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(mdPath, md, 'utf8');
  console.log(`Wrote JSON:  ${jsonPath}`);
  console.log(`Wrote Markdown: ${mdPath}`);
  console.log(`OWASP findings rows: ${(report.findings || []).length}`);
}

async function main() {
  const methodology =
    'OWASP API Security Top 10 (2023) structured review by Ollama over OpenAPI excerpt and optional live probes. Advisory only; not OWASP ZAP/DAST and not a penetration test.';

  let spec;
  let specExcerpt;
  try {
    const specRaw = fs.readFileSync(paths.spec, 'utf8');
    spec = JSON.parse(specRaw);
    specExcerpt = buildSpecExcerpt(spec);
  } catch (e) {
    writeReportBundle({
      generatedAt: new Date().toISOString(),
      specPath: path.relative(process.cwd(), paths.spec),
      baseUrl: (process.env.API_BASE_URL || '').trim() || null,
      methodology,
      scanError: e.message || String(e),
      liveProbe: {
        enabled: false,
        probes: [],
        skipped: [],
        notice: 'Spec not loaded.',
      },
      llm: { ok: false, error: e.message || String(e) },
      findings: [],
    });
    throw e;
  }

  const baseUrl = (process.env.API_BASE_URL || '').trim();
  let live = {
    enabled: false,
    probes: [],
    skipped: [],
    notice: null,
  };

  if (baseUrl) {
    live.enabled = true;
    try {
      const { probes, skipped } = await runLiveProbes(spec, baseUrl);
      live.probes = probes;
      live.skipped = skipped;
    } catch (e) {
      live.scanWarning = e.message || String(e);
    }
  } else {
    live.notice =
      'Set API_BASE_URL (e.g. https://petstore.swagger.io/v2) to attach live HTTP probe facts for the model.';
  }

  const ollamaPayload = {
    specExcerpt,
    host: spec.host || null,
    schemes: spec.schemes || [],
    probes: live.probes,
    probeSkipped: live.skipped,
    liveEnabled: live.enabled,
  };

  let llm = { ok: false, error: 'Ollama not invoked' };
  try {
    const llmResult = await runSecurityOllama(ollamaPayload, getOllamaConfig);
    llm = llmResult.ok
      ? { ok: true, data: llmResult.data, raw: llmResult.raw }
      : {
          ok: false,
          error: llmResult.error || 'Unknown Ollama error',
          raw: llmResult.raw,
        };
  } catch (e) {
    llm = { ok: false, error: e.message || String(e) };
  }

  const findings = llm.ok ? flattenOllamaFindings(llm.data) : [];

  const report = {
    generatedAt: new Date().toISOString(),
    specPath: path.relative(process.cwd(), paths.spec),
    baseUrl: baseUrl || null,
    methodology,
    liveProbe: live,
    llm,
    findings,
  };

  writeReportBundle(report);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
