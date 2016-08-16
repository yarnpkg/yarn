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
/* eslint quotes: 0 */

import map from "../util/map.js";

let invariant = require("invariant");
let stripBOM  = require("strip-bom");

const TOKEN_TYPES = {
  boolean: "BOOLEAN",
  string: "STRING",
  identifier: "IDENTIFIER",
  eof: "EOF",
  colon: "COLON",
  newline: "NEWLINE",
  indent: "INDENT",
  invalid: "INVALID",
  number: "NUMBER",
  comma: "COMMA",
};

const VALID_PROP_VALUE_TOKENS = [TOKEN_TYPES.boolean, TOKEN_TYPES.string, TOKEN_TYPES.number];

function isValidPropValueToken(token): boolean {
  return VALID_PROP_VALUE_TOKENS.indexOf(token.type) >= 0;
}

type Token = {
  line: number,
  col: number,
  type: string,
  value: boolean | number | string | void
};

export function* tokenise(input: string): Iterator<Token> {
  let lastNewline = false;
  let line = 1;
  let col = 0;

  function buildToken(type, value): Token {
    return { line, col, type, value };
  }

  while (input.length) {
    let chop = 0;

    if (input[0] === "\n") {
      chop++;
      line++;
      col = 0;
      yield buildToken(TOKEN_TYPES.newline);
    } else if (input[0] === "#") {
      // ignore comments
      while (input[chop] !== "\n") {
        chop++;
      }
    } else if (input[0] === " ") {
      if (lastNewline) {
        let indent = "";
        for (let i = 0; input[i] === " "; i++) {
          indent += input[i];
        }

        if (indent.length % 2) {
          throw new TypeError("Invalid number of spaces");
        } else {
          chop = indent.length;
          yield buildToken(TOKEN_TYPES.indent, indent.length / 2);
        }
      } else {
        chop++;
      }
    } else if (input[0] === '"') {
      let val = "";
      for (let i = 0; ; i++) {
        let char = input[i];
        val += char;
        if (i > 0 && char === '"' && input[i - 1] !== "\\" && input[i - 2] !== "\\") {
          break;
        }
      }
      chop = val.length;

      try {
        yield buildToken(TOKEN_TYPES.string, JSON.parse(val));
      } catch (err) {
        if (err instanceof SyntaxError) {
          yield buildToken(TOKEN_TYPES.invalid);
        } else {
          throw err;
        }
      }
    } else if (/^[0-9]/.test(input)) {
      let val = "";
      for (let i = 0; /^[0-9]$/.test(input[i]); i++) {
        val += input[i];
      }
      chop = val.length;

      yield buildToken(TOKEN_TYPES.number, +val);
    } else if (/^true/.test(input)) {
      yield buildToken(TOKEN_TYPES.boolean, true);
      chop = 4;
    } else if (/^false/.test(input)) {
      yield buildToken(TOKEN_TYPES.boolean, false);
      chop = 5;
    } else if (input[0] === ":") {
      yield buildToken(TOKEN_TYPES.colon);
      chop++;
    } else if (input[0] === ",") {
      yield buildToken(TOKEN_TYPES.comma);
      chop++;
    } else if (/^[a-zA-Z]/g.test(input)) {
      let name = "";
      for (let i = 0; i < input.length; i++) {
        let char = input[i];
        if (char === ":" || char === " " || char === "\n" || char === ",") {
          break;
        } else {
          name += char;
        }
      }
      chop = name.length;

      yield buildToken(TOKEN_TYPES.string, name);
    } else {
      yield buildToken(TOKEN_TYPES.invalid);
    }

    if (!chop) {
      // will trigger infinite recursion
      yield buildToken(TOKEN_TYPES.invalid);
    }

    col += chop;
    lastNewline = input[0] === "\n";
    input = input.slice(chop);
  }

  yield buildToken(TOKEN_TYPES.eof);
}

export class Parser {
  constructor(input: string) {
    this.tokens = tokenise(input);
  }

  token: Token;
  tokens: Iterator<Token>;

  next(): Token {
    let item = this.tokens.next();
    if (item.done) {
      throw new Error("No more tokens");
    } else if (item.value) {
      return this.token = item.value;
    } else {
      throw new Error("Expected a token");
    }
  }

  unexpected(msg: string = "Unexpected token") {
    throw new SyntaxError(`${msg} ${this.token.line}:${this.token.col}`);
  }

  expect(tokType: string) {
    if (this.token.type === tokType) {
      this.next();
    } else {
      this.unexpected();
    }
  }

  eat(tokType: string): boolean {
    if (this.token.type === tokType) {
      this.next();
      return true;
    } else {
      return false;
    }
  }

  parse(indent: number = 0): Object {
    let obj = map();

    while (true) {
      let propToken = this.token;

      if (propToken.type === TOKEN_TYPES.newline) {
        let nextToken = this.next();
        if (!indent) {
          // if we have 0 indentation then the next token doesn't matter
          continue;
        }

        if (nextToken.type !== TOKEN_TYPES.indent) {
          // if we have no indentation after a newline then we've gone down a level
          break;
        }

        if (nextToken.value === indent) {
          // all is good, the indent is on our level
          this.next();
        } else {
          // the indentation is less than our level
          break;
        }
      } else if (propToken.type === TOKEN_TYPES.indent) {
        if (propToken.value === indent) {
          this.next();
        } else {
          break;
        }
      } else if (propToken.type === TOKEN_TYPES.eof) {
        break;
      } else if (propToken.type === TOKEN_TYPES.string) {
        // property key
        let key = propToken.value;
        invariant(key, "Expected a key");

        let keys = [key];
        this.next();

        // support multiple keys
        while (this.token.type === TOKEN_TYPES.comma) {
          this.next(); // skip comma

          let keyToken = this.token;
          if (keyToken.type !== TOKEN_TYPES.string) {
            this.unexpected("Expected string");
          }

          let key = keyToken.value;
          invariant(key, "Expected a key");
          keys.push(key);
          this.next();
        }

        let valToken = this.token;

        if (valToken.type === TOKEN_TYPES.colon) { // object
          this.next();

          // parse object
          let val = this.parse(indent + 1);

          for (let key of keys) {
            obj[key] = val;
          }

          if (indent && this.token.type !== TOKEN_TYPES.indent) {
            break;
          }
        } else if (isValidPropValueToken(valToken)) { // plain value
          for (let key of keys) {
            obj[key] = valToken.value;
          }

          this.next();
        } else {
          this.unexpected("Invalid value type");
        }
      } else {
        this.unexpected("Unknown token");
      }
    }

    return obj;
  }
}

export default function(str: string): Object {
  str = stripBOM(str);
  let parser = new Parser(str);
  parser.next();
  return parser.parse();
}
