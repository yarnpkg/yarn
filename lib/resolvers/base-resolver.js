'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
class BaseResolver {
  constructor(request, fragment) {
    this.resolver = request.resolver;
    this.reporter = request.reporter;
    this.fragment = fragment;
    this.registry = request.registry;
    this.request = request;
    this.pattern = request.pattern;
    this.config = request.config;
  }

  fork(Resolver, resolveArg, ...args) {
    const resolver = new Resolver(this.request, ...args);
    resolver.registry = this.registry;
    return resolver.resolve(resolveArg);
  }

  resolve(resolveArg) {
    throw new Error('Not implemented');
  }
}
exports.default = BaseResolver;