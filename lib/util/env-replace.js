'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = envReplace;
const ENV_EXPR = /(\\*)\$\{([^}]+)\}/g;

function envReplace(value, env = process.env) {
  if (typeof value !== 'string' || !value) {
    return value;
  }

  return value.replace(ENV_EXPR, (match, esc, envVarName) => {
    if (esc.length && esc.length % 2) {
      return match;
    }
    if (undefined === env[envVarName]) {
      throw new Error('Failed to replace env in config: ' + match);
    }
    return env[envVarName] || '';
  });
}