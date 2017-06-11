import {BaseFetcher} from 'miniyarn/fetchers/BaseFetcher';
import * as yarnUtils from 'miniyarn/utils/yarn';

// This fetcher is a bit special: it officially supports ALL references, but informally rejects them all.
// It's meant to be used when some fetchers can shortcut this path. For example, if you want to allow loading a dependency from the mirror even though its associed fetcher isn't supported anymore.

export class LastChanceFetcher extends BaseFetcher {
  supports(packageLocator, {env, ... rest}) {
    return true;
  }

  async fetch(packageLocator, {env, ... rest}) {
    throw new Error(`Dependency felt through the Last Chance fetcher, which means other fetchers failed to locate it ("${yarnUtils.getLocatorIdentifier(packageLocator)}")`);
  }
}
