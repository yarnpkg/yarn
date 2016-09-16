/* @flow */

import type {Manifest} from '../../types.js';
import {MessageError} from '../../errors.js';
import RegistryResolver from './registry-resolver.js';
import GitResolver from '../exotics/git-resolver.js';

export default class BowerResolver extends RegistryResolver {
  static registry = 'bower';

  async resolveRequest(): Promise<false | {
    url: string
  }> {
    return this.config.requestManager.request({
      url: `${this.registryConfig.registry}/packages/${this.name}`,
      json: true,
      queue: this.resolver.fetchingQueue,
    });
  }

  async resolve(): Promise<Manifest> {
    const body = await this.resolveRequest();

    if (body) {
      return this.fork(GitResolver, false, `${body.url}#${this.range}`);
    } else {
      throw new MessageError(this.reporter.lang('packageNotFoundRegistry', this.name, 'bower'));
    }
  }
}
