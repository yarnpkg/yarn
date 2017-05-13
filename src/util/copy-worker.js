/* @flow */

import * as fs from 'fs';

type SerializableError = {|
 message: string,
 stack: ?string,
 type: 'Error',
|};
type WorkerMessage = {
  atime: number,
  dest: string,
  mode: number,
  mtime: number,
  src: string,
  type: string,
};
type WorkerCallback = (error: ?SerializableError, data: ?string) => void;

const formatError = (error: string | Error): SerializableError => {
  if (typeof error === 'string') {
    return {
      message: error,
      stack: null,
      type: 'Error',
    };
  }

  return {
    message: error.message,
    stack: error.stack,
    type: 'Error',
  };
};

module.exports = (data: WorkerMessage, callback: WorkerCallback): void => {
  try {
    const readStream = fs.createReadStream(data.src);
    const writeStream = fs.createWriteStream(data.dest, {mode: data.mode});

    readStream.on('error', (error) => callback(error));
    writeStream.on('error', (error) => callback(error));

    writeStream.on('open', () => {
      readStream.pipe(writeStream);
    });

    writeStream.once('close', () => {
      fs.utimes(data.dest, data.atime, data.mtime, (error) => {
        if (error) {
          callback(formatError(error));
        } else {
          callback(null, 'done');
        }
      });
    });
  } catch (error) {
    callback(formatError(error));
  }
};
