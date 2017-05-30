import {GitResolver} from 'miniyarn/resolvers/GitResolver';
import {makeTransformResolver} from 'miniyarn/resolvers/makeTransformResolver';
import * as miscUtils from 'miniyarn/utils/misc';

export let GithubResolver = makeTransformResolver(GitResolver, {
  supports(packageRange, {env}) {
    if (!packageRange.name || !packageRange.reference) return false;

    return miscUtils.isGithubReference(packageRange.reference);
  },

  transformReference(packageRange) {
    return `https://github.com/${packageRange.reference}.git`;
  },
});
