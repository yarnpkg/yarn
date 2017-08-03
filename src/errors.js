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
  EXIT_CODE: ?number;
  EXIT_SIGNAL: ?string;
}

export class ResponseError extends Error {
  constructor(msg: string, responseCode: number) {
    super(msg);
    this.responseCode = responseCode;
  }

  responseCode: number;
}
