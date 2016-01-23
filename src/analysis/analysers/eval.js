// Find code that uses `eval`, `new Function` etc.
//
// BUT this check can be escaped by doing `new (function () {}).constructor` so for full
// protection this needs to be coupled with a runtime patch of:
//
//   Function.prototype.constructor = null;
//
