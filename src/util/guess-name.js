/* @flow */

import url from 'url';

function cleanup(name: string): string {
  name = name.replace(/-\d+\.\d+\.\d+/, '');
  return name.split('.')[0];
}

function guessNameFallback(source: string): string {
  // If cannot parse as url, just return cleaned up last part
  const parts = source.split('/');
  return cleanup(parts[parts.length - 1]);
}

export default function guessName(source: string): string {
  try {
    const parsed = url.parse(source);

    if (!parsed.pathname) {
      return guessNameFallback(source);
    }

    const parts = parsed.pathname.split('/');

    // Priority goes to part that ends with .git
    for (const part of parts) {
      if (part.match(/\.git$/)) {
        return cleanup(part);
      }
    }

    // Most likely a directory
    if (parsed.host == null) {
      return cleanup(parts[parts.length - 1]);
    }

    // A site like github or gitlab
    if (parts.length > 2) {
      return cleanup(parts[2]);
    }

    // Privately hosted package?
    if (parts.length > 1) {
      return cleanup(parts[1]);
    }

    return guessNameFallback(source);
  } catch (e) {
    return guessNameFallback(source);
  }
}
