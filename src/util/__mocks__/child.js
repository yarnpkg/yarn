/* @flow */

const realChild = (require: any).requireActual('./child.js');

realChild.spawn = jest.fn(() => Promise.resolve(''));

module.exports = realChild;
