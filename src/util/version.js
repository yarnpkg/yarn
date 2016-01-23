/* @flow */

export function explodeHashedUrl(url: string): { url: string, hash: string } {
  let parts = url.split("#");

  return {
    url: parts[0],
    hash: parts[1] || ""
  };
}
