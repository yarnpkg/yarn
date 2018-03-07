import * as fs from './fs.js';

const path = require('path');

export type PortableProxyOptions = {|
  proxyBasename?: string,
  extraEnvironment?: Map<string, string>,
  prependArguments?: Array<string>,
  appendArguments?: Array<string>,
|};

async function makePortableProxyScriptUnix(source: string, destination: string, options: PortableProxyOptions): Promise<void> {
  const environment = options.extraEnvironment ? Array.from(options.extraEnvironment.entries()).map(([key, value]) => `${key}="${value}"`).join(' ') : '';

  const prependedArguments = options.prependArguments ? options.prependArguments.map(arg => `"${arg}"`).join(' ') : '';
  const appendedArguments = options.appendArguments ? options.appendArguments.map(arg => `"${arg}"`).join(' ') : '';

  const filePath = `${destination}/${options.proxyBasename || path.basename(source)}`;

  await fs.writeFile(filePath, `#!/bin/sh\n${environment} "${source}" ${prependedArguments} "$@" ${appendedArguments}\n`);
  await fs.chmod(filePath, 0o755);
}

export function makePortableProxyScript(source: string, destination: string, options: PortableProxyOptions = {}): Promise<void> {
  return makePortableProxyScriptUnix(source, destination, options);
}
