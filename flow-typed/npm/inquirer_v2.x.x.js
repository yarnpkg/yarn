// flow-typed signature: df3baa8dc9948e006e9b73243d290c89
// flow-typed version: 25ed2d5c85/inquirer_v2.x.x/flow_>=v0.25.x

// FIXME(ryyppy): Add Observable stuff
// -> https://github.com/SBoudrias/Inquirer.js/#reactive-interface
// Currently, if you are using Observables, you need to : any suffix
// the questions input for now

declare module 'inquirer' {
  declare class BottomBar {
    log: stream$Writable;
    updateBottomBar(input: mixed): void;
  }

  declare type SessionT = any;

  declare type AnswersT = {
    [key: string]: ?boolean | ?string | ?{
      confirm?: boolean,
      input?: string,
      rawList?: string,
      list?: string,
    }
  };

  declare class Separator {
    constructor(sep ?: string): void;
  }

  declare type ChoiceT = string | Separator | {
    name: string,
    value?: string,
    short?: string,
  };

  declare type QuestionKindT =
    'input'
    | 'confirm'
    | 'list'
    | 'rawlist'
    | 'expand'
    | 'checkbox'
    | 'password'
    | 'editor'; 

  declare type DefaultValueT = string | number | Array<string|number>;

  declare type BasicT = string | number | boolean;

  declare type QuestionT = {
    type: QuestionKindT,
    name: string,
    message: string | (a: AnswersT) => void,
    default?: mixed | (a: AnswersT) => mixed,
    choices?: Array<ChoiceT>, 

    // true => okay
    // false => general error message
    // string => specific error message
    validate?: (input: string | Array<string>) => (boolean | string), 
    filter?: (input: string) => BasicT | Promise<BasicT>,
    when?: boolean | (answers: AnswersT) => (boolean | Promise<boolean>),
    pageSize?: number,
  };
  
  declare interface Prompt extends Promise<AnswersT> {
    ui: {
      process: any, // For observable interface
    },
  }

  declare type PromptFn = (questions: QuestionT | Array<QuestionT>) => Prompt;

  declare module.exports: {
    Separator: typeof Separator,
    prompt: PromptFn, 
    ui: {
      BottomBar: typeof BottomBar,
    },
  };
}
