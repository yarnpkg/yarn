/* @flow */

import * as constants from "../constants";
import { BlockingQueue } from "./blocking-queue";
import { promisify } from "./promise";

let child = require("child_process");

export let exec = promisify(child.exec);

export let queue = new BlockingQueue(constants.CHILD_CONCURRENCY);

// TODO: this uid check is kinda whack
let uid = 0;

export function spawn(
  program: string,
  args: Array<string>,
  opts?: child_process$spawnOpts = {}
): Promise<string> {
  return queue.push(opts.cwd || String(++uid), () => new Promise((resolve, reject) => {
    let proc = child.spawn(program, args, opts);

    let processingDone = false;
    let processClosed = false;
    let err = null;

    let errBuf = "";
    let buf = "";

    proc.on("error", reject);

    proc.stderr.on("data", (chunk) => {
      errBuf += chunk;
    });

    function update(chunk) {
      buf += chunk;
    }

    function finish() {
      if (err) {
        reject(err);
      } else {
        resolve(buf.trim());
      }
    }

    if (opts.process) {
      opts.process(proc, update, reject, function () {
        if (processClosed) {
          finish();
        } else {
          processingDone = true;
        }
      });
    } else {
      proc.stdout.on("data", update);
      processingDone = true;
    }

    proc.on("close", (code) => {
      if (code >= 1) {
        if (!errBuf) errBuf = `Process exited with code ${code}`;

        let cmd = JSON.stringify(`${program} ${args.join(" ")}`);
        err = new Error(`${cmd}@${opts.cwd || process.cwd()}: ${errBuf.trim()}`);
      }

      if (processingDone) {
        finish();
      } else {
        processClosed = true;
      }
    });
  }));
}
