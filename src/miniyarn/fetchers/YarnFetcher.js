import invariant from 'invariant';
import semver from 'semver';
import Url from 'url';

import {HttpFetcher} from 'miniyarn/fetchers/HttpFetcher';
import {makeTransformFetcher} from 'miniyarn/fetchers/makeTransformFetcher';
import * as yarnUtils from 'miniyarn/utils/yarn';

export let YarnFetcher = makeTransformFetcher(HttpFetcher, {
  supports(packageLocator, {env}) {
    if (!packageLocator.reference) return false;

    return semver.validRange(packageLocator.reference);
  },

  transformReference(packageLocator, {env}) {
    let {scope, localName} = yarnUtils.parseIdentifier(packageLocator.name);

    if (scope) {
      return Url.resolve(env.REGISTRY_URL, `/@${scope}/${localName}/-/${localName}-${packageLocator.reference}.tgz`);
    } else {
      return Url.resolve(env.REGISTRY_URL, `/${localName}/-/${localName}-${packageLocator.reference}.tgz`);
    }
  },
});
