/* @flow */

import map from "../util/map.js";

let invariant = require("invariant");

const tokTypes = {
  boolean: "BOOLEAN",
  string: "STRING",
  identifier: "IDENTIFIER",
  eof: "EOF",
  colon: "COLON",
  newline: "NEWLINE",
  indent: "INDENT",
  invalid: "INVALID"
};

type Token = {
  line: number,
  col: number,
  type: string,
  value: ?any
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
      yield buildToken(tokTypes.newline);
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
          yield buildToken(tokTypes.indent, indent.length / 2);
        }
      } else {
        chop++;
      }
    } else if (input[0] === '"') {
      let val = "";
      for (let i = 0;; i++) {
        let char = input[i];
        val += char;
        if (i > 0 && char === '"' && input[i - 1] !== "\\" && input[i - 2] !== "\\") {
          break;
        }
      }
      chop = val.length;

      try {
        yield buildToken(tokTypes.string, JSON.parse(val));
      } catch (err) {
        if (err instanceof SyntaxError) {
          yield buildToken(tokTypes.invalid);
        } else {
          throw err;
        }
      }
    } else if (/^true/.test(input)) {
      yield buildToken(tokTypes.boolean, true);
      chop = 4;
    } else if (/^false/.test(input)) {
      yield buildToken(tokTypes.boolean, false);
      chop = 5;
    } else if (input[0] === ":") {
      yield buildToken(tokTypes.colon);
      chop++;
    } else {
      let name = "";
      for (let i = 0; i < input.length; i++) {
        let char = input[i];
        if (char === ":" || char === " " || char === "\n") {
          break;
        } else {
          name += char;
        }
      }
      chop = name.length;

      yield buildToken(tokTypes.string, name);
    }

    if (!chop) {
      // will trigger infinite recursion
      yield buildToken(tokTypes.invalid);
    }

    col += chop;
    lastNewline = input[0] === "\n";
    input = input.slice(chop);
  }

  yield buildToken(tokTypes.eof);
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

  unexpected(msg: string = "Unexpected token"): void {
    throw new SyntaxError(`${msg} ${this.token.line}:${this.token.col}`);
  }

  expect(tokType: string) {
    if (this.token.type === tokType) {
      this.next();
    } else {
      this.unexpected();
    }
  }

  parse(indent: number = 0): Object {
    let obj = map();

    while (true) {
      let propToken = this.token;

      if (propToken.type === tokTypes.newline) {
        let nextToken = this.next();
        if (!indent) {
          // if we have 0 indentation then the next token does not matterthis.next();
          continue;
        }

        if (nextToken.type !== tokTypes.indent) {
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
      } else if (propToken.type === tokTypes.indent) {
        if (propToken.value === indent) {
          this.next();
        } else {
          break;
        }
      } else if (propToken.type === tokTypes.eof) {
        break;
      } else if (propToken.type === tokTypes.string) {
        // property key
        let key = propToken.value;
        invariant(key, "Expected a key");

        let valToken = this.next();
        if (valToken.type === tokTypes.colon) {
          this.next();
          obj[key] = this.parse(indent + 1);
        } else if (valToken.type === tokTypes.string || valToken.type === tokTypes.boolean) {
          obj[key] = valToken.value;
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

export default function (str: string): Object {
  let parser = new Parser(str);
  parser.next();
  return parser.parse();
}
