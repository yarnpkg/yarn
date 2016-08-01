/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

import type { Stdout } from "../types.js";
import { clearLine } from "./util.js";

let repeat = require("repeating");

export default class ProgressBar {
  constructor(total: number, stdout: Stdout = process.stderr) {
    this.stdout = stdout;
    this.total  = total;
    this.chars  = ProgressBar.bars[0].split("");
    this.delay  = 60;
    this.curr   = 0;
  }

  stdout: Stdout;
  curr: number;
  total: number;
  width: number;
  chars: [string, string];
  delay: number;
  id: ?number;

  static bars = [
    "█░"
  ];

  tick() {
    this.curr++;

    // schedule render
    if (!this.id) {
      this.id = setTimeout((): void => this.render(), this.delay);
    }

    // progress complete
    if (this.curr >= this.total) {
      clearTimeout(this.id);
      clearLine(this.stdout);
    }
  }

  render() {
    // clear throttle
    clearTimeout(this.id);
    this.id = null;

    let ratio = this.curr / this.total;
    ratio = Math.min(Math.max(ratio, 0), 1);

    // progress without bar
    let bar = ` ${this.curr}/${this.total}`;

    // calculate size of actual bar
    // $FlowFixMe: investgiate process.stderr.columns flow error
    let availableSpace = Math.max(0, this.stdout.columns - bar.length);
    let width          = Math.min(this.total, availableSpace);
    let completeLength = Math.round(width * ratio);
    let complete   = repeat(this.chars[0], completeLength);
    let incomplete = repeat(this.chars[1], width - completeLength);
    bar = `${complete}${incomplete}${bar}`;

    //
    clearLine(this.stdout);
    this.stdout.write(bar);
  }
}
