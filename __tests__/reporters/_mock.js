/* @flow */

import type Reporter from '../../src/reporters/base-reporter.js';
const Stdin = require('mock-stdin').stdin.Class;
const {Writable} = require('stream');

export type MockData = {
  stdout: string,
  stderr: string,
};

type Interceptor<T> = (data: MockData, reporter: Reporter, prepared: any) => T;

type MockCallback = (reporter: Reporter, opts: Object) => ?Promise<void>;

export default function<T>(
  Reporter: Function,
  interceptor: Interceptor<T>,
  prepare?: ?(reporter: Reporter) => any,
  opts?: Object,
): (callback: MockCallback) => Promise<T> {
  return async function(callback: MockCallback): * {
    const data: MockData = {
      stderr: '',
      stdout: '',
    };

    const buildStream = (key): Writable => {
      const stream = new Writable();

      // $FlowFixMe: TODO add to flow definition
      stream.columns = 1000;

      // $FlowFixMe: TODO ditto
      stream.write = msg => {
        stream.emit('data', msg);
        data[key] += msg;
      };

      return stream;
    };

    const newOpts = {
      stdin: new Stdin(),
      stdout: buildStream('stdout'),
      stderr: buildStream('stderr'),
      emoji: true,
      ...(opts || {}),
    };

    const reporter = new Reporter(newOpts);
    let prepared;

    if (prepare) {
      prepared = prepare(reporter);
    }

    reporter.peakMemory = 0;
    reporter.isTTY = true;
    reporter.getTotalTime = (): number => 0;

    await callback(reporter, newOpts);
    reporter.close();

    for (const key in data) {
      data[key] = data[key].trim();
    }

    return interceptor(data, reporter, prepared);
  };
}
