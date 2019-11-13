/* @flow */

import * as fs from './fs.js';

const path = require('path');

export type PortableProxyOptions = {|
  proxyBasename?: string,
  extraEnvironment?: Map<string, string>,
  prependArguments?: Array<string>,
  appendArguments?: Array<string>,
  pnpPackageName?: string,
|};

async function makePortableProxyScriptUnix(
  source: string,
  destination: string,
  options: PortableProxyOptions,
): Promise<void> {
  const environment = options.extraEnvironment
    ? Array.from(options.extraEnvironment.entries()).map(([key, value]) => `${key}="${value}"`).join(' ') + ' '
    : '';

  const prependedArguments = options.prependArguments
    ? ' ' + options.prependArguments.map(arg => `"${arg}"`).join(' ')
    : '';
  const appendedArguments = options.appendArguments
    ? ' ' + options.appendArguments.map(arg => `"${arg}"`).join(' ')
    : '';

  const filePath = `${destination}/${options.proxyBasename || path.basename(source)}`;

  // Unless impossible we want to preserve any symlinks used to call us when forwarding the call to the binary (so we
  // cannot use realpath or transform relative paths into absolute ones), but we also need to tell the sh interpreter
  // that the symlink should be resolved relative to the script directory (hence dirname "$0" at runtime).
  const sourcePath = path.isAbsolute(source) ? source : `$(dirname "$0")/../${source}`;

  await fs.mkdirp(destination);

  if (process.platform === 'win32') {
    await fs.writeFile(
      filePath + '.cmd',
      `@${environment}"${sourcePath}" ${prependedArguments} ${appendedArguments} %*\r\n`,
    );
  } else {
    await fs.writeFile(
      filePath,
      `#!/bin/sh\n\n${environment}exec "${sourcePath}"${prependedArguments} "$@"${appendedArguments}\n`,
    );
    await fs.chmod(filePath, 0o755);
  }
}

export function makePortableProxyScript(
  source: string,
  destination: string,
  // $FlowFixMe Flow doesn't support exact types with empty default values
  options: PortableProxyOptions = {},
): Promise<void> {
  return makePortableProxyScriptUnix(source, destination, options);
}
