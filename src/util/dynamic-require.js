/* @flow */

// $FlowFixMe We want this require to be dynamic
exports.dynamicRequire = typeof __webpack_require__ !== 'undefined' ? __non_webpack_require__ : require; // eslint-disable-line
