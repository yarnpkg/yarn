/* @flow */

import JSONReporter from './json-reporter.js';

const {EventEmitter} = require('events');

export default class EventReporter extends JSONReporter {
  emit: (type: string, data: mixed) => void;

  constructor(opts: Object) {
    super(opts);

    // $FlowFixMe: looks like a flow bug
    EventEmitter.call(this);
  }

  _dump(type: string, data: mixed) {
    this.emit(type, data);
  }
}

Object.assign(EventReporter.prototype, EventEmitter.prototype);
