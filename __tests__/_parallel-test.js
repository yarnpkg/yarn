/* @flow */

export default function(title: string, fn: () => ?Promise<any>, test?: typeof it = it) {
  let promise;
  try {
    // first run the test
    promise = fn();
  } catch (error) {
    promise = Promise.reject(error);
  }

  // then register a test with existing (already running) promise
  test(title, (): ?Promise<any> => promise);
}
