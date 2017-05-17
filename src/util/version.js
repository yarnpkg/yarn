/* @flow */

export function explodeHashedUrl(url: string): {url: string, hash: string} {
  const parts = url.split('#');

  return {
    hash: parts[1] || '',
    url: parts[0],
  };
}
