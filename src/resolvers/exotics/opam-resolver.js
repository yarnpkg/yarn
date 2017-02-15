/* @flow */

import type {Manifest} from '../../types.js';
import type Config from '../../config';
import path from 'path';
import type PackageRequest from '../../package-request.js';
import ExoticResolver from './exotic-resolver.js';
import * as fs from '../../util/fs.js';

export type OpamManifestCollection = {
  versions: {
    [name: string]: OpamManifest,
  }
};

type File = {
  name: string,
  content: string,
};

export type OpamManifest = Manifest & {
  opam: {
    url: string,
    files?: Array<File>,
    checksum?: string,
    patch?: string,
  }
};

// TODO: fix it
const OPAM_METADATA_STORE = '/Users/andreypopp/Workspace/esy/opam-packages';

const OPAM_SCOPE = 'opam-alpha';

export default class OpamResolver extends ExoticResolver {

  constructor(request: PackageRequest, fragment: string) {
    super(request, fragment);

    const {name, version} = parseOpamResolution(fragment);
    this.name = name;
    this.version = version;
  }

  name: string;
  version: string;

  static isVersion(pattern: string): boolean {
    if (pattern.startsWith(`@${OPAM_SCOPE}`)) {
      return true;
    }

    return false;
  }

  static getPatternVersion(pattern: string, pkg: Manifest): string {
    return pkg.version;
  }

  async resolve(): Promise<Manifest> {
    const shrunk = this.request.getLocked('opam');
    if (shrunk) {
      return shrunk;
    }

    const manifest = await lookupOpamPackageManifest(this.name, this.version, this.config);
    const reference = `${manifest.name}@${manifest.version}`;

    manifest._remote = {
      type: 'opam',
      registry: 'npm',
      hash: manifest.opam.checksum,
      reference,
      resolved: reference,
    };

    return manifest;
  }
}

export function parseOpamResolution(fragment: string): {name: string, version: string} {
  fragment = fragment.slice(`@{OPAM_SCOPE}/`.length);
  const [name, version = '*'] = fragment.split('@');
  return {
    name,
    version,
  };
}

export async function lookupOpamPackageManifest(
  name: string,
  versionRange: string,
  config: Config,
): Promise<OpamManifest> {
  const packageRecordFilename = path.join(OPAM_METADATA_STORE, `${name}.json`);

  if (!await fs.exists(packageRecordFilename)) {
    throw new Error(`No package found: @${OPAM_SCOPE}/${name}`);
  }

  const packageCollection = await fs.readJson(packageRecordFilename);
  const versions = Object.keys(packageCollection.versions);
  if (versionRange == null || versionRange === 'latest') {
    versionRange = '*';
  }
  const version = await config.resolveConstraints(versions, versionRange);
  if (version == null) {
    // TODO: figure out how to report error
    throw new Error(`No compatible version found: ${versionRange}`);
  }
  const packageJson = packageCollection.versions[version];
  packageJson._uid = packageJson.opam.checksum || packageJson.version;
  return packageJson;
}
