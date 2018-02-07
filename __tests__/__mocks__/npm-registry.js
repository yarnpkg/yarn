/* @flow */

import Registry from '../../src/registries/base-registry.js';
import type {RegistryRequestOptions} from '../../src/registries/base-registry.js';

export default class NpmRegistry extends Registry {
  request(pathname: string, opts?: RegistryRequestOptions = {}, packageName: ?string): Promise<*> {
    return new Promise(resolve => resolve());
  }
}
