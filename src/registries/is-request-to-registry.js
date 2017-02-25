/* @flow */

import url from 'url';

export default function isRequestToRegistry(requestUrl: string, registry: string): boolean {
  const requestParsed = url.parse(requestUrl);
  const registryParsed = url.parse(registry);
  const requestPort = getPortOrDefaultPort(requestParsed.port, requestParsed.protocol);
  const registryPort = getPortOrDefaultPort(registryParsed.port, registryParsed.protocol);
  const requestPath = requestParsed.path || '';
  const registryPath = registryParsed.path || '';

  return (requestParsed.protocol === registryParsed.protocol) &&
        (requestParsed.hostname === registryParsed.hostname) &&
        (requestPort === registryPort) &&
        requestPath.startsWith(registryPath);
}

function getPortOrDefaultPort(port: ?string, protocol: ?string): ?string {
  const defaultPort = !port;
  if (defaultPort && protocol === 'https:') {
    return '443';
  }
  if (defaultPort && protocol === 'http:') {
    return '80';
  }
  return port;
}
