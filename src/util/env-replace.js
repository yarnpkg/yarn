/* @flow */
const ENV_EXPR = /(\\*)\$\{([^}]+)\}/g;

export default function envReplace(value: string, env: {[key: string]: ?string} = process.env): string {
  if (typeof value !== 'string' || !value) {
    return value;
  }

  return value.replace(ENV_EXPR, (match: string, esc: string, envVarName: string) => {
    if (esc.length && esc.length % 2) {
      return match;
    }
    if (undefined === env[envVarName]) {
      throw new Error('Failed to replace env in config: ' + match);
    }
    return env[envVarName] || '';
  });
}
