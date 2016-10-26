/* @flow */
import envReplace from '../../src/util/env-replace';
import assert from 'assert';

test('environment variable replacement', () => {

  it('will replace a token that exists in the environment', () => {
    let result = envReplace('test ${a} replacement', {a: 'token'});
    assert(result === 'test token replacement');

    result = envReplace('${a} replacement', {a: 'token'});
    assert(result === 'token replacement');

    result = envReplace('${a}', {a: 'token'});
    assert(result === 'token');
  });

  it('will not replace a token that does not exist in the environment', () => {
    const result = envReplace('${a} replacement', {b: 'token'});
    assert(result === '${a} replacement');
  });

  it('will not replace a token when a the token-replacement mechanism is prefixed with backslashes', () => {
    const result = envReplace('\\${a} replacement', {a: 'token'});
    assert(result === '${a} replacement');
  });
});
