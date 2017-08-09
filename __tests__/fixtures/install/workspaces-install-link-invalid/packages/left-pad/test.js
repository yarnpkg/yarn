var leftPad = require('./');
var test = require('tape');

test('left pad', function(assert) {
  assert.plan(7);
  assert.strictEqual(leftPad('foo', 5), '  foo');
  assert.strictEqual(leftPad('foobar', 6), 'foobar');
  assert.strictEqual(leftPad(1, 2, 0), '01');
  assert.strictEqual(leftPad(1, 2, '-'), '-1');
  assert.strictEqual(leftPad('foo', 2, ' '), 'foo');
  assert.strictEqual(leftPad('foo', -1, ' '), 'foo');
  assert.strictEqual(leftPad('foo', 7, 1), '1111foo');
});
