/* @flow */

export function explodeHashedUrl(url: string): {url: string, hash: string} {
  const pos = url.indexOf('#');
  return {
    hash: pos > -1 ? url.substring(pos + 1) : '',
    url: pos > -1 ? url.substring(0, pos) : url,
  };
}
