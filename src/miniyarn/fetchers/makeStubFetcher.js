import {BaseFetcher} from 'miniyarn/fetchers/BaseFetcher';

export function makeStubFetcher({packageInfo, handler}) {
  return new class StubFetcher extends BaseFetcher {
    supports(packageLocator, {env}) {
      return true;
    }

    async fetch(packageLocator, {fetcher, env}) {
      return {packageInfo, handler};
    }
  };
}
