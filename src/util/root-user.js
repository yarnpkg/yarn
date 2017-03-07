/* @flow */

function getUid(): ?number {
  if (process.platform !== 'win32' && process.getuid) {
    return process.getuid();
  }
  return null;
}

export default isRootUser(getUid());

export function isRootUser(uid: ?number): boolean {
  return uid === 0;
}
