/* @flow */
import {spawn, forwardSignalToSpawnedProcesses} from '../../src/util/child.js';

let mockSpawnedChildren = [];

jest.mock('child_process', () => {
  class MockedChildProcess {
    stdout: Object;
    stderr: Object;
    receivedSignal: string;
    exitWithCode: number => void;

    constructor() {
      this.stdout = {
        on: () => {},
      };
      this.stderr = {
        on: () => {},
      };
    }

    kill(signal) {
      this.receivedSignal = signal;
    }

    on(event, handler) {
      if (event === 'close') {
        this.exitWithCode = handler;
      }
    }
  }

  const realChildProcess = (require: any).requireActual('child_process');

  realChildProcess.spawn = cmd => {
    const newChild = new MockedChildProcess();
    mockSpawnedChildren.push(newChild);
    return newChild;
  };

  return realChildProcess;
});

const expectChildReceivedSignal = (child, signal) => {
  expect(child.receivedSignal).toEqual(signal);
};

beforeEach(() => {
  mockSpawnedChildren = [];
});

it('should forward signals to all spawned child processes', () => {
  spawn('foo', []).then(() => {}, () => {});
  spawn('bar', []).then(() => {}, () => {});

  expect(mockSpawnedChildren.length).toEqual(2);

  forwardSignalToSpawnedProcesses('SIGTERM');

  expectChildReceivedSignal(mockSpawnedChildren[0], 'SIGTERM');
  expectChildReceivedSignal(mockSpawnedChildren[1], 'SIGTERM');
});

it('should not attempt to forward signals to children that already terminated', () => {
  spawn('foo', []).then(() => {}, () => {});
  spawn('bar', []).then(() => {}, () => {});

  const fooProcess = mockSpawnedChildren[0];
  fooProcess.exitWithCode(0);
  forwardSignalToSpawnedProcesses('SIGTERM');

  expectChildReceivedSignal(mockSpawnedChildren[0], undefined);
  expectChildReceivedSignal(mockSpawnedChildren[1], 'SIGTERM');
});
