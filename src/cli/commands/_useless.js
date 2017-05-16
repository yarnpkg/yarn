/* @flow */

import {MessageError} from '../../errors.js';

export default function(message: string): {run: Function, useless: boolean} {
  return {
    useless: true,
    run() {
      throw new MessageError(message);
    },
    setFlags: () => {},
    hasWrapper: () => true,
  };
}
