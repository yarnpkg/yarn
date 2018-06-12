/* @flow */

export function explodeHashedUrl(url: string): {url: string, hash: string} {
  const [server, ...hashes] = url.split('#');

  return {
    hash: hashes.length ? hashes.join('#') : '',
    url: server,
  };
}
