/**
 * isArray
 */

const isArray = Array.isArray;

/**
 * toString
 */

const str = Object.prototype.toString;

/**
 * Whether or not the given `val`
 * is an array.
 *
 * example:
 *
 *        isArray([]);
 *        // > true
 *        isArray(arguments);
 *        // > false
 *        isArray('');
 *        // > false
 *
 * @param {mixed} val
 * @return {bool}
 */

module.exports =
  isArray ||
  function(val) {
    return !!val && '[object Array]' == str.call(val);
  };
