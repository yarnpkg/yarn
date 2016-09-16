/* @flow */

import {MessageError} from '../../errors.js';

export default function(message: string): { run: Function } {
  return {
    run() {
      throw new MessageError(message);
    },
  };
}
