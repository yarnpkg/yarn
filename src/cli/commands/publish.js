/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import NpmRegistry from '../../registries/npm-registry.js';
import {MessageError} from '../../errors.js';
import {setVersion, setFlags as versionSetFlags} from './version.js';
import * as fs from '../../util/fs.js';
import {pack} from './pack.js';
import {getToken} from './login.js';
import path from 'path';

const invariant = require('invariant');
const crypto = require('crypto');
const url = require('url');
const fs2 = require('fs');
const ssri = require('ssri');

export function setFlags(commander: Object) {
  versionSetFlags(commander);
  commander.description('Publishes a package to the npm registry.');
  commander.usage('publish [<tarball>|<folder>] [--tag <tag>] [--access <public|restricted>]');
  commander.option('--access [access]', 'access');
  commander.option('--tag [tag]', 'tag');
}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

function getPublishConfigAccess(pkg: any, flags: Object): ?string {
  if (typeof flags.access === 'string') {
    return flags.access;
  }
  if (pkg && pkg.publishConfig && typeof pkg.publishConfig.access === 'string') {
    return pkg.publishConfig.access;
  }
  return undefined;
}

function getPublishConfigRegistry(config: Config, pkg: any, flags: Object): string {
  // CLI flag has the highest priority.
  if (typeof flags.registry === 'string') {
    return flags.registry;
  }
  // if `publishConfig` exists, it overrides the default registry settings.
  if (pkg && pkg.publishConfig) {
    const publishConfig = pkg.publishConfig;
    const scope = config.registries.npm.getScope(pkg.name);
    // if the package is scoped, scoped registry in `publishConfig` has priority 2.
    if (scope) {
      const scopedRegistry = publishConfig[`${scope}:registry`];
      if (typeof scopedRegistry === 'string') {
        return scopedRegistry;
      }
    }
    // use `publishConfig.registry` even if the package is scoped, as long as it doesn't have scoped registry
    const unscopedRegistry = publishConfig.registry;
    if (typeof unscopedRegistry === 'string') {
      return unscopedRegistry;
    }
  }
  return '';
}

function getPublishConfigTag(pkg: any, flags: Object): string {
  if (typeof flags.tag === 'string') {
    return flags.tag;
  }
  if (pkg && pkg.publishConfig && typeof pkg.publishConfig.tag === 'string') {
    return pkg.publishConfig.tag;
  }
  return 'latest';
}

async function publish(config: Config, pkg: any, flags: Object, dir: string): Promise<void> {
  // check package.json for `publishConfig.access`, override with `--access` flag
  // see: https://docs.npmjs.com/files/package.json#publishconfig
  const access = getPublishConfigAccess(pkg, flags);

  // validate access argument
  if (access && access !== 'public' && access !== 'restricted') {
    throw new MessageError(config.reporter.lang('invalidAccess'));
  }

  // TODO this might modify package.json, do we need to reload it?
  await config.executeLifecycleScript('prepublish');
  await config.executeLifecycleScript('prepare');
  await config.executeLifecycleScript('prepublishOnly');
  await config.executeLifecycleScript('prepack');

  // get tarball stream
  const stat = await fs.lstat(dir);
  let stream;
  if (stat.isDirectory()) {
    stream = await pack(config);
  } else if (stat.isFile()) {
    stream = fs2.createReadStream(dir);
  } else {
    throw new Error("Don't know how to handle this file type");
  }
  const buffer = await new Promise((resolve, reject) => {
    const data = [];
    invariant(stream, 'expected stream');
    stream.on('data', data.push.bind(data)).on('end', () => resolve(Buffer.concat(data))).on('error', reject);
  });

  await config.executeLifecycleScript('postpack');

  // copy normalized package and remove internal keys as they may be sensitive or yarn specific
  pkg = Object.assign({}, pkg);
  for (const key in pkg) {
    if (key[0] === '_') {
      delete pkg[key];
    }
  }

  const tag = getPublishConfigTag(pkg, flags);
  const tbName = `${pkg.name}-${pkg.version}.tgz`;
  const tbURI = `${pkg.name}/-/${tbName}`;

  // create body
  const root = {
    _id: pkg.name,
    access,
    name: pkg.name,
    description: pkg.description,
    'dist-tags': {
      [tag]: pkg.version,
    },
    versions: {
      [pkg.version]: pkg,
    },
    readme: pkg.readme || '',
    _attachments: {
      [tbName]: {
        content_type: 'application/octet-stream',
        data: buffer.toString('base64'),
        length: buffer.length,
      },
    },
  };

  pkg._id = `${pkg.name}@${pkg.version}`;
  pkg.dist = pkg.dist || {};
  pkg.dist.shasum = crypto.createHash('sha1').update(buffer).digest('hex');
  pkg.dist.integrity = ssri.fromData(buffer).toString();

  const registry = String(config.getOption('registry'));
  pkg.dist.tarball = url.resolve(registry, tbURI).replace(/^https:\/\//, 'http://');

  // publish package
  try {
    await config.registries.npm.request(NpmRegistry.escapeName(pkg.name), {
      registry: getPublishConfigRegistry(config, pkg, flags),
      method: 'PUT',
      body: root,
    });
  } catch (error) {
    throw new MessageError(config.reporter.lang('publishFail', error.message));
  }

  await config.executeLifecycleScript('publish');
  await config.executeLifecycleScript('postpublish');
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  // validate arguments
  const dir = args[0] ? path.resolve(config.cwd, args[0]) : config.cwd;
  if (args.length > 1) {
    throw new MessageError(reporter.lang('tooManyArguments', 1));
  }
  if (!await fs.exists(dir)) {
    throw new MessageError(reporter.lang('unknownFolderOrTarball'));
  }

  const stat = await fs.lstat(dir);
  let publishPath = dir;
  if (stat.isDirectory()) {
    config.cwd = path.resolve(dir);
    publishPath = config.cwd;
  }

  // validate package fields that are required for publishing
  const pkg = await config.readRootManifest();
  if (pkg.private) {
    throw new MessageError(reporter.lang('publishPrivate'));
  }
  if (!pkg.name) {
    throw new MessageError(reporter.lang('noName'));
  }

  reporter.step(1, 4, reporter.lang('bumpingVersion'));
  const commitVersion = await setVersion(config, reporter, flags, [], false);

  //
  reporter.step(2, 4, reporter.lang('loggingIn'));
  const revoke = await getToken(config, reporter, pkg.name, flags, getPublishConfigRegistry(config, pkg, flags));

  //
  reporter.step(3, 4, reporter.lang('publishing'));
  await publish(config, pkg, flags, publishPath);
  await commitVersion();
  reporter.success(reporter.lang('published'));

  //
  reporter.step(4, 4, reporter.lang('revokingToken'));
  await revoke();
}
