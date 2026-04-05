'use strict';

const fs = require('fs');

const { parseEndpoint } = require('./swaggerChange');

function loadOpenApiSpec(specPath) {
  try {
    return JSON.parse(fs.readFileSync(specPath, 'utf8'));
  } catch (e) {
    console.warn(`⚠️  Could not read OpenAPI spec ${specPath}: ${e.message}`);
    return null;
  }
}

function getOperationFromChange(spec, change) {
  if (!spec || !spec.paths) return null;
  const { path: p, method: m } = parseEndpoint(change.endpoint);
  const item = spec.paths[p];
  if (!item || !item[m]) return null;
  return { pathKey: p, method: m, operation: item[m] };
}

function pathLiteralSegments(apiPath) {
  return apiPath.split('/').filter((seg) => seg && !/^\{.+\}$/.test(seg));
}

function petServiceLikelyHasPath(serviceSrc, apiPath) {
  const segs = pathLiteralSegments(apiPath);
  const nonPet = segs.filter((s) => s !== 'pet');
  if (nonPet.length === 0) {
    return serviceSrc.includes('"/pet"');
  }
  return nonPet.every((s) => serviceSrc.includes(s));
}

function isPostPetUploadImageOperation(operationDetail) {
  if (!operationDetail || !operationDetail.pathKey) return false;
  const m = String(operationDetail.method || '').toLowerCase();
  return m === 'post' && operationDetail.pathKey.includes('uploadImage');
}

module.exports = {
  loadOpenApiSpec,
  getOperationFromChange,
  pathLiteralSegments,
  petServiceLikelyHasPath,
  isPostPetUploadImageOperation
};
