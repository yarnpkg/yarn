const { parentPort } = require("worker_threads");
const fs = require("fs");

parentPort.on("message", (o) => {
  try {
    let running = o.actions.length;
    o.actions.forEach(a => {
      fs.copyFile(a.src, a.dest, 0, err => {
        if (err) {
          o.port.emit("error", err);
        } else {
          running -= 1;
          running === 0 && o.port.postMessage("");
        }
      });
    })
  } catch (e) {
        o.port.emit("error", e);
  }
})
