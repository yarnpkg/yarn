/* @flow */

export class MessageError extends Error {
  constructor(msg: string, code?: string) {
    super(msg);
    this.code = code;
  }

  code: ?string;
}

export class PackageVersionError extends Error {
  constructor(packageName: string, requestedVersion: string, resolvedVersion: string, manifest: Manifest) {
    super();
    this.packageName = packageName;
    this.requestedVersion = requestedVersion;
    this.resolvedVersion = resolvedVersion;
    this.manifest = manifest;
  }
  packageName: string;
  requestedVersion: string;
  resolvedVersion: string;
  manifest: Manifest;
}

export class SecurityError extends MessageError {}

export class SpawnError extends MessageError {
  EXIT_CODE: number;
}
