/* @flow */

export type YarnHook = 'resolveStep' | 'fetchStep' | 'linkStep' | 'buildStep' | 'pnpStep' | 'auditStep' | 'runScript';

const YARN_HOOKS_KEY = 'experimentalYarnHooks';

export function callThroughHook<T>(type: YarnHook, fn: () => T, context?: any): T {
  if (typeof global === 'undefined') {
    return fn();
  }

  if (typeof global[YARN_HOOKS_KEY] !== 'object' || !global[YARN_HOOKS_KEY]) {
    return fn();
  }

  const hook: (() => T, context?: any) => T = global[YARN_HOOKS_KEY][type];

  if (!hook) {
    return fn();
  }

  return hook(fn, context);
}
