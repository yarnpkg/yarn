/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import executeLifecycleScript from './_execute-lifecycle-script.js';
import NpmRegistry from '../../registries/npm-registry.js';
import {ConcatStream} from '../../util/stream.js';
import {MessageError} from '../../errors.js';
import {setVersion, setFlags as versionSetFlags} from './version.js';
import * as fs from '../../util/fs.js';
import {pack} from './pack.js';
import {getToken} from './login.js';

const invariant = require('invariant');
const crypto = require('crypto');
const url = require('url');
const fs2 = require('fs');

export function setFlags(commander: Object) {
  versionSetFlags(commander);
  commander.usage('publish [<tarball>|<folder>] [--tag <tag>] [--access <public|restricted>]');
  commander.option('--access [access]', 'access');
  commander.option('--tag [tag]', 'tag');
}

async function publish(
  config: Config,
  pkg: any,
  flags: Object,
  dir: string,
): Promise<void> {
  // validate access argument
  const access = flags.access;
  if (access && access !== 'public' && access !== 'restricted') {
    throw new MessageError(config.reporter.lang('invalidAccess'));
  }

  // get tarball stream
  const stat = await fs.lstat(dir);
  let stream;
  if (stat.isDirectory()) {
    stream = await pack(config, dir);
  } else if (stat.isFile()) {
    stream = fs2.createReadStream(dir);
  } else {
    throw new Error("Don't know how to handle this file type");
  }
  invariant(stream, 'expected stream');
  const buffer = await new Promise((resolve, reject) => {
    stream.pipe(new ConcatStream(resolve)).on('error', reject);
  });

  // copy normalized package and remove internal keys as they may be sensitive or yarn specific
  pkg = Object.assign({}, pkg);
  for (const key in pkg) {
    if (key[0] === '_') {
      delete pkg[key];
    }
  }

  const tag = flags.tag || 'latest';
  const tbName = `${pkg.name}-${pkg.version}.tgz`;
  const tbURI = `${pkg.name}/-/${tbName}`;

  // TODO this might modify package.json, do we need to reload it?
  await executeLifecycleScript(config, 'prepublish');

  // create body
  const root = {
    _id: pkg.name,
    access: flags.access,
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
        'content_type': 'application/octet-stream',
        data: buffer.toString('base64'),
        length: buffer.length,
      },
    },
  };

  pkg._id = `${pkg.name}@${pkg.version}`;
  pkg.dist = pkg.dist || {};
  pkg.dist.shasum = crypto.createHash('sha1').update(buffer).digest('hex');

  const registry = String(config.getOption('registry'));
  pkg.dist.tarball = url.resolve(registry, tbURI).replace(/^https:\/\//, 'http://');

  // publish package
  const res = await config.registries.npm.request(NpmRegistry.escapeName(pkg.name), {
    method: 'PUT',
    body: root,
  });

  if (res != null && res.success) {
    await executeLifecycleScript(config, 'publish');
    await executeLifecycleScript(config, 'postpublish');
  } else {
    throw new MessageError(config.reporter.lang('publishFail'));
  }
}

export async function run(
 config: Config,
 reporter: Reporter,
 flags: Object,
 args: Array<string>,
): Promise<void> {
  // validate package fields that are required for publishing
  const pkg = await config.readRootManifest();
  if (pkg.private) {
    throw new MessageError(reporter.lang('publishPrivate'));
  }
  if (!pkg.name) {
    throw new MessageError(reporter.lang('noName'));
  }

  // validate arguments
  const dir = args[0] || config.cwd;
  if (args.length > 1) {
    throw new MessageError(reporter.lang('tooManyArguments', 1));
  }
  if (!(await fs.exists(dir))) {
    throw new MessageError(reporter.lang('unknownFolderOrTarball'));
  }

  //
  reporter.step(1, 4, reporter.lang('bumpingVersion'));
  const commitVersion = await setVersion(config, reporter, flags, args, false);

  //
  reporter.step(2, 4, reporter.lang('loggingIn'));
  const revoke = await getToken(config, reporter, pkg.name);

  //
  reporter.step(3, 4, reporter.lang('publishing'));
  await publish(config, pkg, flags, dir);
  await commitVersion();
  reporter.success(reporter.lang('published'));

  //
  reporter.step(4, 4, reporter.lang('revokingToken'));
  await revoke();
}
