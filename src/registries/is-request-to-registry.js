/* @flow */

import url from 'url';

export default function isRequestToRegistry(requestUrl: string, registry: string, customHostSuffix: ?any): boolean {
  const requestParsed = url.parse(requestUrl);
  const registryParsed = url.parse(registry);
  const requestHost = requestParsed.hostname || '';
  const registryHost = registryParsed.hostname || '';
  const requestPort = getPortOrDefaultPort(requestParsed.port, requestParsed.protocol);
  const registryPort = getPortOrDefaultPort(registryParsed.port, registryParsed.protocol);
  const requestPath = requestParsed.path || '';
  const registryPath = registryParsed.path || '';

  return (
    requestHost === registryHost &&
    requestPort === registryPort &&
    (requestPath.startsWith(registryPath) ||
      // For some registries, the package path does not prefix with the registry path
      (!!customHostSuffix && customHostSuffix.length > 0 && requestHost.endsWith(customHostSuffix)))
  );
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
