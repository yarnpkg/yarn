/* @flow */

let os = require("os");

const IGNORE_INTERFACES = ["lo0", "awdl0", "bridge0"];
const LOCAL_IPS = ["127.0.0.1", "::1"];

export function isOffline(): boolean {
  let interfaces = os.networkInterfaces();

  for (let name in interfaces) {
    if (IGNORE_INTERFACES.indexOf(name) >= 0) continue;

    let addrs = interfaces[name];
    for (let addr of addrs) {
      if (LOCAL_IPS.indexOf(addr.address) < 0) {
        // found a possible local ip
        return false;
      }
    }
  }

  return true;
}
