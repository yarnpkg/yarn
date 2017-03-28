/* @flow */

export function explodeHashedUrl(url: string): { url: string, hash: string } {
  const parts = url.split('#');

  if (/\.git-/.test(url)) {
    const hashes = url.split('.git-').pop().split('#')

    return {
      url: parts[0],
      hash: hashes[0]
    }
  }

  return {
    url: parts[0],
    hash: parts[1] || '',
  };
}
