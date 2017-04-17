/* @flow */

import url from 'url';

export default function isRequestToRegistry(requestUrl: string, registry: string): boolean {
  const requestParsed = url.parse(requestUrl);
  const registryParsed = url.parse(registry);
  const requestPort = getPortOrDefaultPort(requestParsed.port, requestParsed.protocol);
  const registryPort = getPortOrDefaultPort(registryParsed.port, registryParsed.protocol);
  const requestPath = requestParsed.path || '';
  const registryPath = registryParsed.path || '';

  return (requestParsed.hostname === registryParsed.hostname) &&
        (requestPort === registryPort) &&
        requestPath.startsWith(registryPath);
}

function getPortOrDefaultPort(port: ?string, protocol: ?string): ?string {
  if (protocol === 'https:' && port === '443') {
    return null;
  }
  if (protocol === 'http:' && port === '80') {
    return null;
  }
  return port;
}
