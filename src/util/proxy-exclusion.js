/* @flow */

import {URL} from 'url';

type Zone = {
  hostname: string,
  port: number,
  hasPort: boolean,
};

function formatHostname(hostname: string): string {
  // canonicalize the hostname, so that 'oogle.com' won't match 'google.com'
  return hostname.replace(/^\.*/, '.').toLowerCase();
}

function parseNoProxyZone(zone: string): Zone {
  zone = zone.trim().toLowerCase();

  const zoneParts = zone.split(':', 2);
  const hostname = formatHostname(zoneParts[0]);
  const port: number = (zoneParts[1]: any);
  const hasPort = zone.indexOf(':') > -1;

  return {
    hostname,
    port,
    hasPort,
  };
}

export default function isExcludedFromProxy(url: string, noProxy: string): boolean {
  if (!noProxy) {
    return false;
  }

  if (noProxy === '*') {
    return true;
  }

  const uri = new URL(url);

  const port = uri.port || (uri.protocol === 'https:' ? '443' : '80');
  const hostname = formatHostname(uri.hostname);
  const noProxyList = noProxy.split(',');

  // iterate through the noProxyList until it finds a match.
  return noProxyList.map(parseNoProxyZone).some(noProxyZone => {
    const isMatchedAt = hostname.indexOf(noProxyZone.hostname);
    const hostnameMatched = isMatchedAt > -1 && isMatchedAt === hostname.length - noProxyZone.hostname.length;

    if (noProxyZone.hasPort) {
      return port === noProxyZone.port && hostnameMatched;
    }

    return hostnameMatched;
  });
}
