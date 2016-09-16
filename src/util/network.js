/* @flow */

const os = require('os');

const IGNORE_INTERFACES = ['lo0', 'awdl0', 'bridge0'];
const LOCAL_IPS = ['127.0.0.1', '::1'];

export function isOffline(): boolean {
  const interfaces = os.networkInterfaces();

  for (const name in interfaces) {
    if (IGNORE_INTERFACES.indexOf(name) >= 0) {
      continue;
    }

    const addrs = interfaces[name];
    for (const addr of addrs) {
      if (LOCAL_IPS.indexOf(addr.address) < 0) {
        // found a possible local ip
        return false;
      }
    }
  }

  return true;
}
