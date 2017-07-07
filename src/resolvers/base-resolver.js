/* @flow */

import type PackageRequest from '../package-request.js';
import type PackageResolver from '../package-resolver.js';
import type {Manifest} from '../types.js';
import type {RegistryNames} from '../registries/index.js';
import type {Reporter} from '../reporters/index.js';
import type Config from '../config.js';

export default class BaseResolver {
  constructor(request: PackageRequest, fragment: string) {
    this.resolver = request.resolver;
    this.reporter = request.reporter;
    this.fragment = fragment;
    this.registry = request.registry;
    this.request = request;
    this.pattern = request.pattern;
    this.config = request.config;
  }

  static +isVersion: string => boolean;
  resolver: PackageResolver;
  reporter: Reporter;
  fragment: string;
  request: PackageRequest;
  pattern: string;
  config: Config;
  registry: RegistryNames;

  fork(Resolver: Class<BaseResolver>, resolveArg: any, ...args: Array<string>): Promise<Manifest> {
    const resolver = new Resolver(this.request, ...args);
    resolver.registry = this.registry;
    return resolver.resolve(resolveArg);
  }

  resolve(resolveArg?: any): Promise<Manifest> {
    throw new Error('Not implemented');
  }
}
