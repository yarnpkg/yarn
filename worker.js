// @flow
const {parentPort} = require('worker_threads');
const fs = require('fs');

parentPort.on('message', o => {
  try {
    let running = o.actions.length;
    // Safety short circuit in case we somehow start a worker with nothing.
    running === 0 && parentPort.postMessage('');

    o.actions.forEach(a => {
      fs.copyFile(a.src, a.dest, 0, err => {
        if (err) {
          parentPort.emit('error', err);
        } else {
          running -= 1;
          running === 0 && parentPort.postMessage('');
        }
      });
    });
  } catch (e) {
    parentPort.emit('error', e);
  }
});
