/* @flow */

export class MessageError extends Error {
  constructor(msg: string, code?: string) {
    super(msg);
    this.code = code;
  }

  code: ?string;
}

export class PackageVersionError extends Error {
  constructor(packageName: string, requestedVersion: string, resolvedVersion: string) {
    super();
    this.packageName = packageName;
    this.requestedVersion = requestedVersion;
    this.resolvedVersion = resolvedVersion;
  }
  packageName: string;
  requestedVersion: string;
  resolvedVersion: string;
}

export class SecurityError extends MessageError {}

export class SpawnError extends MessageError {
  EXIT_CODE: number;
}
