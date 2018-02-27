/* @flow */

import type {Stdout} from '../types.js';
import {writeOnNthLine, clearNthLine} from './util.js';

export default class Spinner {
  constructor(stdout: Stdout = process.stderr, lineNumber?: number = 0) {
    this.current = 0;
    this.prefix = '';
    this.lineNumber = lineNumber;
    this.stdout = stdout;
    this.delay = 60;
    this.chars = Spinner.spinners[28].split('');
    this.text = '';
    this.id = null;
  }

  stdout: Stdout;
  prefix: string;
  current: number;
  lineNumber: number;
  delay: number;
  chars: Array<string>;
  text: string;
  id: ?TimeoutID;

  static spinners: Array<string> = [
    '|/-\\',
    '⠂-–—–-',
    '◐◓◑◒',
    '◴◷◶◵',
    '◰◳◲◱',
    '▖▘▝▗',
    '■□▪▫',
    '▌▀▐▄',
    '▉▊▋▌▍▎▏▎▍▌▋▊▉',
    '▁▃▄▅▆▇█▇▆▅▄▃',
    '←↖↑↗→↘↓↙',
    '┤┘┴└├┌┬┐',
    '◢◣◤◥',
    '.oO°Oo.',
    '.oO@*',
    '🌍🌎🌏',
    '◡◡ ⊙⊙ ◠◠',
    '☱☲☴',
    '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏',
    '⠋⠙⠚⠞⠖⠦⠴⠲⠳⠓',
    '⠄⠆⠇⠋⠙⠸⠰⠠⠰⠸⠙⠋⠇⠆',
    '⠋⠙⠚⠒⠂⠂⠒⠲⠴⠦⠖⠒⠐⠐⠒⠓⠋',
    '⠁⠉⠙⠚⠒⠂⠂⠒⠲⠴⠤⠄⠄⠤⠴⠲⠒⠂⠂⠒⠚⠙⠉⠁',
    '⠈⠉⠋⠓⠒⠐⠐⠒⠖⠦⠤⠠⠠⠤⠦⠖⠒⠐⠐⠒⠓⠋⠉⠈',
    '⠁⠁⠉⠙⠚⠒⠂⠂⠒⠲⠴⠤⠄⠄⠤⠠⠠⠤⠦⠖⠒⠐⠐⠒⠓⠋⠉⠈⠈',
    '⢄⢂⢁⡁⡈⡐⡠',
    '⢹⢺⢼⣸⣇⡧⡗⡏',
    '⣾⣽⣻⢿⡿⣟⣯⣷',
    '⠁⠂⠄⡀⢀⠠⠐⠈',
  ];
  setPrefix(prefix: string) {
    this.prefix = prefix;
  }
  setText(text: string) {
    this.text = text;
  }
  start() {
    this.current = 0;
    this.render();
  }
  render() {
    if (this.id) {
      clearTimeout(this.id);
    }
    // build line ensuring we don't wrap to the next line
    let msg = `${this.prefix}${this.chars[this.current]} ${this.text}`;
    const columns = typeof this.stdout.columns === 'number' ? this.stdout.columns : 100;
    msg = msg.slice(0, columns);
    writeOnNthLine(this.stdout, this.lineNumber, msg);
    this.current = ++this.current % this.chars.length;
    this.id = setTimeout((): void => this.render(), this.delay);
  }
  stop() {
    if (this.id) {
      clearTimeout(this.id);
      this.id = null;
    }
    clearNthLine(this.stdout, this.lineNumber);
  }
}
