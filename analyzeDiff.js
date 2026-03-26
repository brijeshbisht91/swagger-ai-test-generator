function classifyChange(d) {
    const apiPath = d.path?.[0];
    let method = d.path?.[1];

    if (!apiPath) return null;

    // For full endpoint add/delete, deep-diff often returns only the API path.
    // Try to infer HTTP method(s) from lhs/rhs operation object.
    if (!method && d.path?.length === 1) {
      const source = d.rhs || d.lhs || {};
      const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];
      const found = httpMethods.filter((m) => Object.prototype.hasOwnProperty.call(source, m));
      method = found.length ? found.join('|') : 'all';
    }

    const fullPath = (d.path || []).join(".");
  
    let changeCategory = "UNKNOWN";
  
    if (fullPath.includes("parameters")) {
      if (fullPath.includes("in.body")) {
        changeCategory = "BODY_CHANGE";
      } 
      else if (fullPath.includes("in.query")) {
        changeCategory = "QUERY_PARAM_CHANGE";
      } 
      else if (fullPath.includes("in.path")) {
        changeCategory = "PATH_PARAM_CHANGE";
      } 
      else if (fullPath.includes("in.formData")) {
        changeCategory = "FORMDATA_CHANGE";
      } 
      else {
        changeCategory = "PARAM_CHANGE";
      }
    }
    else if (fullPath.includes("responses")) {
      changeCategory = "RESPONSE_CHANGE";
    }
    else if (d.path?.length === 1) {
      changeCategory = "ENDPOINT_CHANGE";
    }
    else if (fullPath.includes("summary") || fullPath.includes("description")) {
      changeCategory = "DOC_CHANGE";
    }
  
    return {
      endpoint: `${apiPath}#${method}`,
      type:
        d.kind === 'N'
          ? 'NEW'
          : d.kind === 'D'
          ? 'DELETED'
          : 'UPDATED',
      category: changeCategory,
      fullPath
    };
  }
  
  // ✅ THIS WAS MISSING
  function analyzeChanges(diff) {
    const changes = [];
  
    diff.forEach(d => {
      const result = classifyChange(d);
      if (result) changes.push(result);
    });
  
    return changes;
  }
  
  // ✅ THIS WAS ALSO MISSING
  module.exports = { analyzeChanges };