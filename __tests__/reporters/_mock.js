/* @flow */

import type Reporter from '../../src/reporters/base-reporter.js';
let Stdin = require('mock-stdin').stdin.Class;
let {Writable} = require('stream');

export type MockData = {
  stdout: string,
  stderr: string
};

type Interceptor<T> = (data: MockData, reporter: Reporter) => T;

type MockCallback = (reporter: Reporter, opts: Object) => ?Promise<void>;

export default function<T>(
  Reporter: Function,
  interceptor: Interceptor<T>,
): (callback: MockCallback) => Promise<T> {
  return async function (callback: MockCallback): * {
    let data: MockData = {
      stderr: '',
      stdout: '',
    };

    let buildStream = (key): Writable => {
      let stream = new Writable();

      // $FlowFixMe: TODO add to flow definition
      stream.columns = 1000;

      // $FlowFixMe: TODO ditto
      stream.write = (msg) => {
        stream.emit('data', msg);
        data[key] += msg;
      };

      return stream;
    };

    let opts = {
      stdin: new Stdin(),
      stdout: buildStream('stdout'),
      stderr: buildStream('stderr'),
      emoji: true,
    };

    let reporter = new Reporter(opts);

    reporter.peakMemory = 0;
    reporter.isTTY = true;
    reporter.getTotalTime = (): number => 0;

    await callback(reporter, opts);
    reporter.close();

    for (let key in data) {
      data[key] = data[key].trim();
    }

    return interceptor(data, reporter);
  };
}
