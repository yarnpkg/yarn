/* @flow */

export class SecurityError extends Error {}

export class MessageError extends Error {}

export class SpawnError extends Error {
  EXIT_CODE: number;
}
