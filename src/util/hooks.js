/* @flow */

export type YarnHook = 'resolveStep' | 'fetchStep' | 'linkStep' | 'buildStep' | 'pnpStep' | 'auditStep';

const YARN_HOOKS_KEY = 'experimentalYarnHooks';

export function callThroughHook<T>(type: YarnHook, fn: () => T): T {
  if (typeof global === 'undefined') {
    return fn();
  }

  if (typeof global[YARN_HOOKS_KEY] !== 'object' || !global[YARN_HOOKS_KEY]) {
    return fn();
  }

  const hook: (() => T) => T = global[YARN_HOOKS_KEY][type];

  if (!hook) {
    return fn();
  }

  return hook(fn);
}
