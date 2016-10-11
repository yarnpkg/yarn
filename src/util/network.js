/* @flow */

const os = require('os');

const IGNORE_INTERFACES = ['lo0', 'awdl0', 'bridge0'];
const LOCAL_IPS = ['127.0.0.1', '::1'];

export function isOffline(): boolean {
  let interfaces;

  try {
    interfaces = os.networkInterfaces();
  } catch (e) {
    // As of October 2016, Windows Subsystem for Linux (WSL) does not support
    // the os.networkInterfaces() call and throws instead. For this platform,
    // assume we are online.
    if (e.syscall === 'uv_interface_addresses') {
      return false;
    } else {
      throw e;
    }
  }

  for (const name in interfaces) {
    if (IGNORE_INTERFACES.indexOf(name) >= 0) {
      continue;
    }

    const addrs = interfaces[name];
    for (const addr of addrs) {
      if (LOCAL_IPS.indexOf(addr.address) < 0) {
        // found a possible remote ip
        return false;
      }
    }
  }

  return true;
}
