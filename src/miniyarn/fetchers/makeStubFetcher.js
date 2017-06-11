import {BaseFetcher} from 'miniyarn/fetchers/BaseFetcher';

export function makeStubFetcher({packageInfo, handler}) {
  return new class StubFetcher extends BaseFetcher {
    supports(packageLocator, {env, ... rest}) {
      return true;
    }

    async fetch(packageLocator, {env, ... rest}) {
      return {packageInfo, handler};
    }
  };
}
