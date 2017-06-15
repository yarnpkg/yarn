/* @flow */
import envReplace from '../../src/util/env-replace';

describe('environment variable replacement', () => {
  it('will replace a token that exists in the environment', () => {
    let result = envReplace('test ${a} replacement', {a: 'token'});
    expect(result).toEqual('test token replacement');

    result = envReplace('${a} replacement', {a: 'token'});
    expect(result).toEqual('token replacement');

    result = envReplace('${a}', {a: 'token'});
    expect(result).toEqual('token');
  });

  it('will not replace a token that does not exist in the environment', () => {
    let thrown = false;
    try {
      envReplace('${a} replacement', {b: 'token'});
    } catch (err) {
      thrown = true;
      expect(err.message).toEqual('Failed to replace env in config: ${a}');
    }
    expect(thrown).toEqual(true);
  });

  it('will not replace a token when a the token-replacement mechanism is prefixed a backslash literal', () => {
    const result = envReplace('\\${a} replacement', {a: 'token'});
    expect(result).toEqual('\\${a} replacement');
  });
});
