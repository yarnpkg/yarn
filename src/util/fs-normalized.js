/* @flow */

// This module serves as a wrapper for file operations that are inconsistant across node and OS versions.

import fs from 'fs';
import {promisify} from './promise.js';

import {constants} from './fs';

export type CopyFileAction = {
  src: string,
  dest: string,
  atime: Date,
  mtime: Date,
  mode: number,
};

let disableTimestampCorrection: ?boolean = undefined; // OS dependent. will be detected on first file copy.

const readFileBuffer = promisify(fs.readFile);
const close: (fd: number) => Promise<void> = promisify(fs.close);
const lstat: (path: string) => Promise<fs.Stats> = promisify(fs.lstat);
const open: (path: string, flags: string | number, mode: number) => Promise<number> = promisify(fs.open);
const futimes: (fd: number, atime: number, mtime: number) => Promise<void> = promisify(fs.futimes);

const write: (
  fd: number,
  buffer: Buffer,
  offset: ?number,
  length: ?number,
  position: ?number,
) => Promise<void> = promisify(fs.write);

export const unlink: (path: string) => Promise<void> = promisify(require('rimraf'));

/**
 * Unlinks the destination to force a recreation. This is needed on case-insensitive file systems
 * to force the correct naming when the filename has changed only in character-casing. (Jest -> jest).
 */
export const copyFile = async function(data: CopyFileAction, cleanup: () => mixed): Promise<void> {
  // $FlowFixMe: Flow doesn't currently support COPYFILE_FICLONE
  const ficloneFlag = constants.COPYFILE_FICLONE || 0;
  try {
    await unlink(data.dest);
    await copyFilePoly(data.src, data.dest, ficloneFlag, data);
  } finally {
    if (cleanup) {
      cleanup();
    }
  }
};

// Node 8.5.0 introduced `fs.copyFile` which is much faster, so use that when available.
// Otherwise we fall back to reading and writing files as buffers.
const copyFilePoly: (src: string, dest: string, flags: number, data: CopyFileAction) => Promise<void> = (
  src,
  dest,
  flags,
  data,
) => {
  if (fs.copyFile) {
    return new Promise((resolve, reject) =>
      fs.copyFile(src, dest, flags, err => {
        if (err) {
          reject(err);
        } else {
          fixTimes(undefined, dest, data).then(() => resolve()).catch(ex => reject(ex));
        }
      }),
    );
  } else {
    return copyWithBuffer(src, dest, flags, data);
  }
};

const copyWithBuffer: (src: string, dest: string, flags: number, data: CopyFileAction) => Promise<void> = async (
  src,
  dest,
  flags,
  data,
) => {
  // Use open -> write -> futimes -> close sequence to avoid opening the file twice:
  // one with writeFile and one with utimes
  const fd = await open(dest, 'w', data.mode);
  try {
    const buffer = await readFileBuffer(src);
    await write(fd, buffer, 0, buffer.length);
    await fixTimes(fd, dest, data);
  } finally {
    await close(fd);
  }
};

// We want to preserve file timestamps when copying a file, since yarn uses them to decide if a file has
// changed compared to the cache.
// There are some OS specific cases here:
// * On linux, fs.copyFile does not preserve timestamps, but does on OSX and Win.
// * On windows, you must open a file with write permissions to call `fs.futimes`.
// * On OSX you can open with read permissions and still call `fs.futimes`.
async function fixTimes(fd: ?number, dest: string, data: CopyFileAction): Promise<void> {
  const doOpen = fd === undefined;
  let openfd: number = fd ? fd : -1;

  if (disableTimestampCorrection === undefined) {
    // if timestamps match already, no correction is needed.
    // the need to correct timestamps varies based on OS and node versions.
    const destStat = await lstat(dest);
    disableTimestampCorrection = fileDatesEqual(destStat.mtime, data.mtime);
  }

  if (disableTimestampCorrection) {
    return;
  }

  if (doOpen) {
    try {
      openfd = await open(dest, 'a', data.mode);
    } catch (er) {
      // file is likely read-only
      try {
        openfd = await open(dest, 'r', data.mode);
      } catch (err) {
        // We can't even open this file for reading.
        return;
      }
    }
  }

  try {
    if (openfd) {
      await futimes(openfd, data.atime, data.mtime);
    }
  } catch (er) {
    // If `futimes` throws an exception, we probably have a case of a read-only file on Windows.
    // In this case we can just return. The incorrect timestamp will just cause that file to be recopied
    // on subsequent installs, which will effect yarn performance but not break anything.
  } finally {
    if (doOpen && openfd) {
      await close(openfd);
    }
  }
}

// Compare file timestamps.
// Some versions of Node on windows zero the milliseconds when utime is used.
export const fileDatesEqual = (a: Date, b: Date) => {
  const aTime = a.getTime();
  const bTime = b.getTime();

  if (process.platform !== 'win32') {
    return aTime === bTime;
  }

  // See https://github.com/nodejs/node/pull/12607
  // Submillisecond times from stat and utimes are truncated on Windows,
  // causing a file with mtime 8.0079998 and 8.0081144 to become 8.007 and 8.008
  // and making it impossible to update these files to their correct timestamps.
  if (Math.abs(aTime - bTime) <= 1) {
    return true;
  }

  const aTimeSec = Math.floor(aTime / 1000);
  const bTimeSec = Math.floor(bTime / 1000);

  // See https://github.com/nodejs/node/issues/2069
  // Some versions of Node on windows zero the milliseconds when utime is used
  // So if any of the time has a milliseconds part of zero we suspect that the
  // bug is present and compare only seconds.
  if (aTime - aTimeSec * 1000 === 0 || bTime - bTimeSec * 1000 === 0) {
    return aTimeSec === bTimeSec;
  }

  return aTime === bTime;
};
