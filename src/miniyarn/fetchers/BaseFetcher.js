export class BaseFetcher {
  supports(packageLocator, {env, ... rest}) {
    // Return true if the resolver does support the package

    throw new Error(`Unimplemented supports strategy`);
  }

  async fetch(packageLocator, {env, ... rest}) {
    // Fetch all data for a specified locator, then return an object { packageInfo, handler }
    //
    // - packageInfo is the full packageInfo referenced by the specified locator
    // - handler is a fsUtils.Handler instance that contains the path to something on the filesystem.

    throw new Error(`Unimplemented fetch strategy`);
  }
}
