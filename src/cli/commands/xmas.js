/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';

const emoji = require('node-emoji');

function tree() {
  const s = process.platform === 'win32' ? ' *' : ' \u2605';
  const f = '\uFF0F';
  const b = '\uFF3C';
  const x = process.platform === 'win32' ? ' ' : '';
  const o = [
    '\u0069', '\u0020', '\u0020', '\u0020', '\u0020', '\u0020',
    '\u0020', '\u0020', '\u0020', '\u0020', '\u0020', '\u0020',
    '\u0020', '\u2E1B', '\u2042', '\u2E2E', '&', '@', '\uFF61',
  ];
  const oc = [21, 33, 34, 35, 36, 37];
  const l = '\u005e';

  function w(s) { process.stderr.write(s); }

  w('\n');
  (function T(H) {
    for (let i = 0; i < H; i++) { w(' '); }
    w(x + '\u001b[33m' + s + '\n');
    const M = H * 2 - 1;
    for (let L = 1; L <= H; L++) {
      const O = L * 2 - 2;
      const S = (M - O) / 2;
      for (let i = 0; i < S; i++) { w(' '); }
      w(x + '\u001b[32m' + f);
      for (let i = 0; i < O; i++) {
        w(
          '\u001b[' + oc[Math.floor(Math.random() * oc.length)] + 'm' +
          o[Math.floor(Math.random() * o.length)],
        );
      }
      w(x + '\u001b[32m' + b + '\n');
    }
    w(' ');
    for (let i = 1; i < H; i++) { w('\u001b[32m' + l); }
    w('| ' + x + ' |');
    for (let i = 1; i < H; i++) { w('\u001b[32m' + l); }
    if (H > 10) {
      w('\n ');
      for (let i = 1; i < H; i++) { w(' '); }
      w('| ' + x + ' |');
      for (let i = 1; i < H; i++) { w(' '); }
    }
  })(20);
  w('\n\n');
}

export function hasWrapper() {}

export function run(
 config: Config,
 reporter: Reporter,
 flags: Object,
 args: Array<string>,
): Promise<void> {
  tree();
  reporter.log(`
    ${emoji.get('christmas_tree')}  Yarn ${emoji.get('heart')} 's you. ${emoji.get('christmas_tree')}
    Merry Xmas, Yarn boys and girls.
  `);
  return Promise.resolve();
}
