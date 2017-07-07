/* @flow */

import handleSignals from '../../src/util/signal-handler.js';

(process: any).on = jest.fn();
(process: any).exit = jest.fn();

beforeEach(() => {
  process.on.mockClear();
  process.exit.mockClear();
});

afterAll(() => {
  process.on.mockRestore();
  process.exit.mockRestore();
});

it('should attach a handler for SIGTERM event', () => {
  handleSignals();
  expect(process.on.mock.calls[0][0]).toBe('SIGTERM');
});

it('attached SIGTERM handler should exit with status code 1 when invoked', () => {
  handleSignals();
  const sigtermHandler = process.on.mock.calls[0][1];
  sigtermHandler();
  expect(process.exit.mock.calls).toEqual([[1]]);
});
