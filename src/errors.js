/* @flow */

export class SecurityError extends Error {}

export class MessageError extends Error {
  constructor(msg: string, code?: string) {
    super(msg);
    this.code = code;
  }

  code: ?string;
}

export class SpawnError extends Error {
  EXIT_CODE: number;
}
