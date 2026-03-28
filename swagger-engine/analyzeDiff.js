const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];

function operationObjectAtPath(d, method) {
  if (d.kind === 'D') return d.lhs && d.lhs[method];
  if (d.kind === 'N') return d.rhs && d.rhs[method];
  return (d.lhs && d.lhs[method]) || (d.rhs && d.rhs[method]);
}

/** One change row for a single HTTP verb on a path (avoids post|put mapping only to Post* tests). */
function buildEndpointLevelRecord(d, apiPath, method) {
  const op = operationObjectAtPath(d, method);
  const operationId = op && typeof op === 'object' ? op.operationId : undefined;

  return {
    endpoint: `${apiPath}#${method}`,
    type:
      d.kind === 'N' ? 'NEW' : d.kind === 'D' ? 'DELETED' : 'UPDATED',
    category: 'ENDPOINT_CHANGE',
    fullPath: `${apiPath}.${method}`,
    ...(operationId ? { operationId } : {}),
  };
}

function classifyChange(d) {
  const apiPath = d.path?.[0];
  let method = d.path?.[1];

  if (!apiPath) return null;

  // Path-level add/remove: split one diff per HTTP method so each maps to its own *Test.java.
  if (!method && d.path?.length === 1) {
    const source = d.rhs || d.lhs || {};
    const found = HTTP_METHODS.filter((m) =>
      Object.prototype.hasOwnProperty.call(source, m)
    );
    if (found.length === 0) return null;
    if (found.length === 1) {
      return buildEndpointLevelRecord(d, apiPath, found[0]);
    }
    return found.map((m) => buildEndpointLevelRecord(d, apiPath, m));
  }

  const fullPath = (d.path || []).join('.');

  let changeCategory = 'UNKNOWN';

  if (fullPath.includes('parameters')) {
    if (fullPath.includes('in.body')) {
      changeCategory = 'BODY_CHANGE';
    } else if (fullPath.includes('in.query')) {
      changeCategory = 'QUERY_PARAM_CHANGE';
    } else if (fullPath.includes('in.path')) {
      changeCategory = 'PATH_PARAM_CHANGE';
    } else if (fullPath.includes('in.formData')) {
      changeCategory = 'FORMDATA_CHANGE';
    } else {
      changeCategory = 'PARAM_CHANGE';
    }
  } else if (fullPath.includes('responses')) {
    changeCategory = 'RESPONSE_CHANGE';
  } else if (d.path?.length === 1) {
    changeCategory = 'ENDPOINT_CHANGE';
  } else if (fullPath.includes('summary') || fullPath.includes('description')) {
    changeCategory = 'DOC_CHANGE';
  }

  return {
    endpoint: `${apiPath}#${method}`,
    type:
      d.kind === 'N' ? 'NEW' : d.kind === 'D' ? 'DELETED' : 'UPDATED',
    category: changeCategory,
    fullPath,
  };
}

function analyzeChanges(diff) {
  const changes = [];
  const list = diff || [];

  list.forEach((d) => {
    const result = classifyChange(d);
    if (!result) return;
    if (Array.isArray(result)) {
      result.forEach((r) => changes.push(r));
    } else {
      changes.push(result);
    }
  });

  return changes;
}

module.exports = { analyzeChanges };
