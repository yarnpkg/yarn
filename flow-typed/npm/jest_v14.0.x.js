// flow-typed signature: e2130120dcdc34bf09ff82449b0d508c
// flow-typed version: 230d7577ce/jest_v12.0.x/flow_>=v0.23.x

type JestMockFn = {
  (...args: Array<any>): any;
  mock: {
    calls: Array<Array<any>>;
    instances: any;
  };
  mockClear(): Function;
  mockImplementation(fn: Function): JestMockFn;
  mockImplementationOnce(fn: Function): JestMockFn;
  mockReturnThis(): any;
  mockReturnValue(value: any): JestMockFn;
  mockReturnValueOne(value: any): JestMockFn;
}

declare function beforeEach(fn: Function): void;
declare function describe(name: string, fn: Function): void;
declare function fdescribe(name: string, fn: Function): void;
declare function fit(name: string, fn: Function): ?Promise<void>;
declare function it(name: string, fn: Function): ?Promise<void>;
declare function pit(name: string, fn: Function): Promise<void>;
declare function test(name: string, fn: Function): ?Promise<void>;
declare function xdescribe(name: string, fn: Function): void;
declare function xit(name: string, fn: Function): ?Promise<void>;

type JestExpectType = {
  not: JestExpectType;
  lastCalledWith(...args: Array<any>): void;
  toBe(value: any): void;
  toBeCalled(): void;
  toBeCalledWith(...args: Array<any>): void;
  toBeCloseTo(num: number, delta: any): void;
  toBeDefined(): void;
  toBeFalsy(): void;
  toBeGreaterThan(number: number): void;
  toBeLessThan(number: number): void;
  toBeNull(): void;
  toBeTruthy(): void;
  toBeUndefined(): void;
  toContain(str: string): void;
  toEqual(value: any): void;
  toMatch(regexp: RegExp): void;
  toMatchSnapshot(): void;
  toThrow(message?: string | Error): void;
  toThrowError(message?: string): void;
}

declare function expect(value: any): JestExpectType;

declare var jest: {
  autoMockOff(): void;
  autoMockOn(): void;
  clearAllTimers(): void;
  currentTestPath(): void;
  disableAutomock(): void;
  enableAutomock(): void;
  fn(implementation?: Function): JestMockFn;
  genMockFromModule(moduleName: string): any;
  mock(moduleName: string, moduleFactory?: any): void;
  runAllTicks(): void;
  runAllTimers(): void;
  runOnlyPendingTimers(): void;
  setMock(moduleName: string, moduleExports: any): void;
  unmock(moduleName: string): void;
}

declare var jasmine: {
  DEFAULT_TIMEOUT_INTERVAL: number;
}
