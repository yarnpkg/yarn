/* @flow */
/* global stream$Writable */
/* global stream$Readable */
/* global tty$ReadStream */
/* global tty$WriteStream */

export type Stdout = stream$Writable | tty$WriteStream;
export type Stdin = stream$Readable | tty$ReadStream;
export type Package = {
  name: string,
  version: string,
};

export type Tree = {
  name: string,
  children?: Trees,
  hint?: ?string,
  hidden?: boolean,
  color?: ?string,
};

export type Trees = Array<Tree>;

export type ReporterSpinner = {
  tick: (name: string) => void,
  end: () => void,
};

export type ReporterSelectOption = {
  name: string,
  value: string,
};

export type ReporterSpinnerSet = {
  spinners: Array<ReporterSetSpinner>,
  end: () => void,
};

export type ReporterSetSpinner = {
  clear: () => void,
  setPrefix: (current: number, prefix: string) => void,
  tick: (msg: string) => void,
  end: () => void,
};

export type QuestionOptions = {
  password?: boolean,
  required?: boolean,
};

export type InquirerPromptTypes =
  | 'list'
  | 'rawlist'
  | 'expand'
  | 'checkbox'
  | 'confirm'
  | 'input'
  | 'password'
  | 'editor';

export type PromptOptions = {
  name?: string,
  type?: InquirerPromptTypes,
  validate?: (input: string | Array<string>) => boolean | string,
};
