"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
class MessageError extends Error {
  constructor(msg, code) {
    super(msg);
    this.code = code;
  }

}

exports.MessageError = MessageError;
class ProcessSpawnError extends MessageError {
  constructor(msg, code, process) {
    super(msg, code);
    this.process = process;
  }

}

exports.ProcessSpawnError = ProcessSpawnError;
class SecurityError extends MessageError {}

exports.SecurityError = SecurityError;
class ProcessTermError extends MessageError {}

exports.ProcessTermError = ProcessTermError;
class ResponseError extends Error {
  constructor(msg, responseCode) {
    super(msg);
    this.responseCode = responseCode;
  }

}

exports.ResponseError = ResponseError;
class OneTimePasswordError extends Error {}
exports.OneTimePasswordError = OneTimePasswordError;