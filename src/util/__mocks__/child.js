/* @flow */

const realChild = (require: any).requireActual('./child.js');

realChild.spawn = jest.fn(() => {
  return Promise.resolve('');
});

module.exports = realChild;
