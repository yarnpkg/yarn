/* @flow */

import path from 'path';
import type {FetchedOverride} from '../types.js';
import BaseFetcher from './base-fetcher.js';
import * as fs from '../util/fs.js';
import {MessageError} from '../errors.js';

export default class CopyFetcher extends BaseFetcher {
  async _fetch(): Promise<FetchedOverride> {
    try {
      const {files} = await this.config.readManifest(this.reference, this.registry);
      if (files) {
        await Promise.all(
          ['package.json'].concat(files).map(fileName => {
            const source = path.join(this.reference, fileName);
            const destination = path.join(this.dest, fileName);
            return fs.copy(source, destination, this.reporter);
          }),
        );

        return {
          hash: this.hash || '',
          resolved: null,
        };
      }
    } catch (err) {
      if (err instanceof MessageError) {
        this.reporter.warn(err);
      } else {
        throw err;
      }
    }
    await fs.copy(this.reference, this.dest, this.reporter);
    return {
      hash: this.hash || '',
      resolved: null,
    };
  }
}
