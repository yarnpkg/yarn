/* @flow */
import envReplace from '../../src/util/env-replace';
import assert from 'assert';

describe('environment variable replacement', () => {
  it('will replace a token that exists in the environment', () => {
    let result = envReplace('test ${a} replacement', {a: 'token'});
    assert(result === 'test token replacement', `result: ${result}`);

    result = envReplace('${a} replacement', {a: 'token'});
    assert(result === 'token replacement', `result: ${result}`);

    result = envReplace('${a}', {a: 'token'});
    assert(result === 'token', `result: ${result}`);
  });

  it('will not replace a token that does not exist in the environment', () => {
    let thrown = false;
    try {
      envReplace('${a} replacement', {b: 'token'});
    } catch (err) {
      thrown = true;
      assert(err.message === 'Failed to replace env in config: ${a}', `error message: ${err.message}`);
    }
    assert(thrown);
  });

  it('will not replace a token when a the token-replacement mechanism is prefixed a backslash literal', () => {
    const result = envReplace('\\${a} replacement', {a: 'token'});
    assert(result === '\\${a} replacement', `result: ${result}`);
  });
});
