/* @flow */

import path from 'path';

export function fixCmdWinSpaces(cmd: string): string {
  if (!cmd.includes(' ')) {
    return cmd;
  }

  return cmd
    .split(path.sep)
    .map(segment => {
      return segment.includes(' ') ? `"${segment}"` : segment;
    })
    .join(path.sep);
}
