/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

import {MessageError} from '../../errors.js';

export default function(message: string): { run: Function } {
  return {
    run() {
      throw new MessageError(message);
    },
  };
}
