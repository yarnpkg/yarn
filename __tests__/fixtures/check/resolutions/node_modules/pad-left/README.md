# pad-left [![NPM version](https://img.shields.io/npm/v/pad-left.svg?style=flat)](https://www.npmjs.com/package/pad-left) [![NPM downloads](https://img.shields.io/npm/dm/pad-left.svg?style=flat)](https://npmjs.org/package/pad-left) [![Build Status](https://img.shields.io/travis/jonschlinkert/pad-left.svg?style=flat)](https://travis-ci.org/jonschlinkert/pad-left)

Left pad a string with zeros or a specified string. Fastest implementation.

You might also be interested in [word-wrap](https://github.com/jonschlinkert/word-wrap).

## Install

Install with [npm](https://www.npmjs.com/):

```sh
$ npm install pad-left --save
```

## Usage

```js
var pad = require('pad-left');
pad(  '4', 4, '0') // 0004
pad( '35', 4, '0') // 0035
pad('459', 4, '0') // 0459
```

## Benchmarks

Benchmarks for node.js v6.1.0 versus [left-pad](https://github.com/stevemao/left-pad).

```sh
# benchmark/fixtures/10-custom-char.js (37 bytes)
  pad-left x 14,940,947 ops/sec ±0.81% (87 runs sampled)
  left-pad x 7,901,604 ops/sec ±1.17% (86 runs sampled)

# benchmark/fixtures/10.js (32 bytes)
  pad-left x 13,305,123 ops/sec ±1.53% (84 runs sampled)
  left-pad x 6,979,536 ops/sec ±1.13% (84 runs sampled)

# benchmark/fixtures/100-custom-char.js (38 bytes)
  pad-left x 14,227,637 ops/sec ±1.41% (81 runs sampled)
  left-pad x 1,352,240 ops/sec ±1.51% (86 runs sampled)

# benchmark/fixtures/100.js (34 bytes)
  pad-left x 15,664,561 ops/sec ±0.99% (83 runs sampled)
  left-pad x 1,247,316 ops/sec ±0.96% (87 runs sampled)

# benchmark/fixtures/1000-custom-char.js (40 bytes)
  pad-left x 15,210,294 ops/sec ±1.15% (87 runs sampled)
  left-pad x 159,958 ops/sec ±1.01% (88 runs sampled)

# benchmark/fixtures/1000.js (35 bytes)
  pad-left x 14,157,425 ops/sec ±1.10% (88 runs sampled)
  left-pad x 143,805 ops/sec ±1.08% (87 runs sampled)
```

Benchmarks for node.js v6.1.0 versus [stevemao/left-pad](https://github.com/stevemao/left-pad).

```sh
# benchmark/fixtures/10-custom-char.js (37 bytes)
  pad-left x 13,251,037 ops/sec ±1.40% (84 runs sampled)
  left-pad x 10,745,530 ops/sec ±1.18% (86 runs sampled)

# benchmark/fixtures/10.js (32 bytes)
  pad-left x 13,644,357 ops/sec ±1.33% (87 runs sampled)
  left-pad x 20,107,245 ops/sec ±1.00% (88 runs sampled)

# benchmark/fixtures/100-custom-char.js (38 bytes)
  pad-left x 15,650,330 ops/sec ±1.01% (86 runs sampled)
  left-pad x 9,706,877 ops/sec ±1.13% (87 runs sampled)

# benchmark/fixtures/1000-custom-char.js (40 bytes)
  pad-left x 17,255,593 ops/sec ±0.99% (88 runs sampled)
  left-pad x 6,312,637 ops/sec ±1.16% (87 runs sampled)

# benchmark/fixtures/1000.js (35 bytes)
  pad-left x 15,679,410 ops/sec ±0.99% (90 runs sampled)
  left-pad x 6,439,580 ops/sec ±1.08% (86 runs sampled)
```

## Related projects

You might also be interested in these projects:

* [align-text](https://www.npmjs.com/package/align-text): Align the text in a string. | [homepage](https://github.com/jonschlinkert/align-text)
* [center-align](https://www.npmjs.com/package/center-align): Center-align the text in a string. | [homepage](https://github.com/jonschlinkert/center-align)
* [justified](https://www.npmjs.com/package/justified): Wrap words to a specified length and justified the text. | [homepage](https://github.com/jonschlinkert/justified)
* [pad-right](https://www.npmjs.com/package/pad-right): Right pad a string with zeros or a specified string. Fastest implementation. | [homepage](https://github.com/jonschlinkert/pad-right)
* [repeat-string](https://www.npmjs.com/package/repeat-string): Repeat the given string n times. Fastest implementation for repeating a string. | [homepage](https://github.com/jonschlinkert/repeat-string)
* [right-align-keys](https://www.npmjs.com/package/right-align-keys): Right align the keys of an object. | [homepage](https://github.com/jonschlinkert/right-align-keys)
* [right-align-values](https://www.npmjs.com/package/right-align-values): Right align the values of a given property for each object in an array. Useful… [more](https://www.npmjs.com/package/right-align-values) | [homepage](https://github.com/jonschlinkert/right-align-values)
* [right-align](https://www.npmjs.com/package/right-align): Right-align the text in a string. | [homepage](https://github.com/jonschlinkert/right-align)
* [right-pad-keys](https://www.npmjs.com/package/right-pad-keys): Right pad the keys of an object. | [homepage](https://github.com/jonschlinkert/right-pad-keys)
* [right-pad-values](https://www.npmjs.com/package/right-pad-values): Right pad the values of a given property for each object in an array. Useful… [more](https://www.npmjs.com/package/right-pad-values) | [homepage](https://github.com/jonschlinkert/right-pad-values)
* [word-wrap](https://www.npmjs.com/package/word-wrap): Wrap words to a specified length. | [homepage](https://github.com/jonschlinkert/word-wrap)

## Contributing

Pull requests and stars are always welcome. For bugs and feature requests, [please create an issue](https://github.com/jonschlinkert/pad-left/issues/new).

## Building docs

Generate readme and API documentation with [verb](https://github.com/verbose/verb):

```sh
$ npm install verb && npm run docs
```

Or, if [verb](https://github.com/verbose/verb) is installed globally:

```sh
$ verb
```

## Running tests

Install dev dependencies:

```sh
$ npm install -d && npm test
```

## Author

**Jon Schlinkert**

* [github/jonschlinkert](https://github.com/jonschlinkert)
* [twitter/jonschlinkert](http://twitter.com/jonschlinkert)

## License

Copyright © 2016, [Jon Schlinkert](https://github.com/jonschlinkert).
Released under the [MIT license](https://github.com/jonschlinkert/pad-left/blob/master/LICENSE).

***

_This file was generated by [verb](https://github.com/verbose/verb), v0.9.0, on May 07, 2016._