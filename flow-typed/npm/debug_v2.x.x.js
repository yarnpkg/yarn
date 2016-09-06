declare module 'debug' {
  declare type Debugger = {
    (...args: Array<mixed>): void,
    (formatter: string, ...args: Array<mixed>): void,
    (err: Error, ...args: Array<mixed>): void,
    enabled: boolean,
    log: () => {},
    namespace: string;
  };

  declare function exports(namespace: string): Debugger;

  declare var names: Array<string>;
  declare var skips: Array<string>;
  declare var colors: Array<number>;

  declare function disable(): void;
  declare function enable(namespaces: string): void;
  declare function enabled(name: string): boolean;
  declare function humanize(): void;
  declare function useColors(): boolean;
  declare function log(): void;

  declare var formatters: {
    [formatter: string]: () => {}
  };
};
