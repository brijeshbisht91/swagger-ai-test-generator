'use strict';

function parseEndpoint(endpoint) {
  const [p, methodPart = 'unknown'] = endpoint.split('#');
  return {
    path: p,
    method: methodPart.split('|')[0]
  };
}

function getJavaFileNameFromChange(change) {
  const [p, methodPart = 'unknown'] = change.endpoint.split('#');
  const method = methodPart.split('|')[0];
  const name =
    method.charAt(0).toUpperCase() +
    method.slice(1) +
    p.replace(/[/{}]/g, '');
  return `java-tests/src/test/java/tests/${name}Test.java`;
}

module.exports = {
  parseEndpoint,
  getJavaFileNameFromChange
};
