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

import JSONReporter from './json-reporter.js';

const {EventEmitter} = require('events');

export default class EventReporter extends JSONReporter {
  constructor(opts: Object) {
    super(opts);

    // $FlowFixMe: looks like a flow bug
    EventEmitter.call(this);
  }

  _dump(type: string, data: any) {
    // $FlowFixMe: this is here! we have no `implements` in Flow though...
    this.emit(type, data);
  }
}

// $FlowFixMe: need to "inherit" from it
Object.assign(EventReporter.prototype, EventEmitter.prototype);
