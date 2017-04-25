/* @flow */

import url from 'url';

const SUFFIX_VISUALSTUDIO = '.pkgs.visualstudio.com';

export default function isRequestToRegistry(requestUrl: string, registry: string): boolean {
  const requestParsed = url.parse(requestUrl);
  const registryParsed = url.parse(registry);
  const requestHost = requestParsed.hostname || '';
  const registryHost = registryParsed.hostname || '';
  const requestPort = getPortOrDefaultPort(requestParsed.port, requestParsed.protocol);
  const registryPort = getPortOrDefaultPort(registryParsed.port, registryParsed.protocol);
  const requestPath = requestParsed.path || '';
  const registryPath = registryParsed.path || '';

  return (requestParsed.protocol === registryParsed.protocol) &&
        (requestHost === registryHost) &&
        (requestPort === registryPort) && (
          requestPath.startsWith(registryPath) ||
          // For pkgs.visualstudio.com, the package path does not prefix with the registry path
          requestHost.endsWith(SUFFIX_VISUALSTUDIO)
        );
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
