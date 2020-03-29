/* @flow */

export type DeferredTask = () => Promise<void>;

export class DeferredTasks {
  constructor() {
    this.array = [];
  }

  array: Array<DeferredTask>;

  submit(task: DeferredTask) {
    this.array.push(task);
  }

  async runAll(): Promise<void> {
    await Promise.all(this.array.map(task => task()));
    this.array = [];
  }
}
