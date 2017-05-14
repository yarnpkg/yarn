/* @flow */

import type {Stdout} from '../types.js';
import {clearLine, toStartOfLine} from './util.js';

export default class ProgressBar {
  constructor(total: number, stdout: Stdout = process.stderr) {
    this.stdout = stdout;
    this.total = total;
    this.chars = ProgressBar.bars[0];
    this.delay = 60;
    this.curr = 0;
    clearLine(stdout);
  }

  stdout: Stdout;
  curr: number;
  total: number;
  width: number;
  chars: [string, string];
  delay: number;
  id: ?number;

  static bars = [['█', '░']];

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
    // $FlowFixMe: investigate process.stderr.columns flow error
    const availableSpace = Math.max(0, this.stdout.columns - bar.length - 1);
    const width = Math.min(this.total, availableSpace);
    const completeLength = Math.round(width * ratio);
    const complete = this.chars[0].repeat(completeLength);
    const incomplete = this.chars[1].repeat(width - completeLength);
    bar = `${complete}${incomplete}${bar}`;

    toStartOfLine(this.stdout);
    this.stdout.write(bar);
  }
}
