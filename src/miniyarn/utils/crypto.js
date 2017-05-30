import {createHmac} from 'crypto';

export function sha256(source) {
  return createHmac(`sha256`, `Hello Yarn`).update(source).digest(`hex`);
}
