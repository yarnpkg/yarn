/* @flow */

export class MessageError extends Error {
  constructor(msg: string, code?: string) {
    super(msg);
    this.code = code;
  }

  code: ?string;
}

export class SecurityError extends MessageError {}

export class SpawnError extends MessageError {
  EXIT_CODE: number;
}
