/* @flow */
/* eslint no-unused-vars: 0 */

export default class BaseReporter {
  constructor({ alwaysAnswer }: { alwaysAnswer?: ?string }) {
    this.alwaysAnswer = alwaysAnswer;
    this.startTime    = Date.now();
    this.peakMemory   = 0;

    this.initPeakMemoryCounter();
  }

  peakMemoryInterval: ?numer;
  peakMemory: number;
  alwaysAnswer: ?string;
  startTime: number;

  initPeakMemoryCounter() {
    this.checkPeakMemory();
    this.peakMemoryInterval = setInterval(() => {
      this.checkPeakMemory();
    }, 1000);
  }

  checkPeakMemory() {
    let { heapTotal } = process.memoryUsage();
    if (heapTotal > this.peakMemory) this.peakMemory = heapTotal;
  }

  close() {
    clearInterval(this.peakMemoryInterval);
  }

  getTotalTime(): number {
    return Date.now() - this.startTime;
  }

  // called whenever we begin a step in the CLI.
  step(current: number, total: number, message: string, emoji: string) {}

  // a error message has been triggered. this however does not always meant an abrupt
  // program end.
  error(message: string) {}

  // an info message has been triggered. this provides things like stats and diagnostics.
  info(message: string) {}

  // a warning message has been triggered.
  warn(message: string) {}

  // a success message has been triggered.
  success(message: string) {}

  // a simple log message
  log(message: string) {}

  // a shell command has been executed
  command(command: string) {}

  // the screen shown at the very start of the CLI
  header(command: string) {}

  // the screen shown at the very end of the CLI
  footer() {}

  // render an activity spinner and return a function that will trigger an update
  activity(): {
    tick: (name: string) => void,
    end: () => void
  } {
    return {
      tick(name: string) {},
      end() {}
    };
  }

  //
  question(question: string): Promise<boolean> {
    return Promise.resolve(false);
  }

  // prompt the user to select an option from an array
  select(header: string, question: string, options: Array<string>): Promise<string> {
    return Promise.resolve("");
  }

  // render a progress bar and return a function which when called will trigger an update
  progress(total: number): Function {
    return function () {};
  }
}
