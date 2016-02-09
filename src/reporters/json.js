/* @flow */

import BaseReporter from "./_base.js";

function dump(type, data, error?: boolean) {
  let log = console.log;
  if (error) log = console.error;

  log(JSON.stringify({ type, data }));
}

let activityId = 0;
let progressId = 0;

export default class JSONReporter extends BaseReporter {
  step(current: number, total: number, message: string) {
    dump("step", { message, current, total });
  }

  footer() {
    dump("finished", this.getTotalTime());
  }

  log(msg: string) {
    dump("log", msg);
  }

  command(msg: string) {
    dump("command", msg);
  }

  success(msg: string) {
    dump("success", msg);
  }

  error(msg: string) {
    dump("error", msg, true);
  }

  warn(msg: string) {
    dump("warning", msg);
  }

  info(msg: string) {
    dump("info", msg);
  }
  
  question(): Promise<boolean> {
    return Promise.reject(new Error("Cannot accept questions with the JSON reporter"));
  }

  select(): Promise<string> {
    return Promise.reject(new Error("Cannot accept questions with the JSON reporter"));
  }

  activity(): {
    tick: (name: string) => void,
    end: () => void
  } {
    let id = activityId++;
    dump("activityStart", { id });

    return {
      tick(name: string) {
        dump("activitytick", { id, name });
      },

      end() {
        dump("activityEnd", { id });
      }
    };
  }

  progress(total: number): Function {
    let id = progressId++;
    let current = 0;
    dump("progressStart", { id, total });

    return function () {
      current++;
      dump("progressTick", { id, current });

      if (current === total) {
        dump("progressFinish", { id });
      }
    };
  }
}
