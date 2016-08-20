/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import NpmRegistry from '../../registries/NpmRegistry.js';
import {MessageError} from '../../errors.js';
import {run as runVersion, setFlags as versionSetFlags} from './version.js';
import * as fs from '../../util/fs.js';
import {pack} from './pack.js';
import {getToken} from './login.js';

let invariant = require('invariant');
let crypto = require('crypto');
let concat = require('concat-stream');
let url = require('url');
let fs2 = require('fs');

export function setFlags(commander: Object) {
  versionSetFlags(commander);
  commander.usage('publish [<tarball>|<folder>] [--tag <tag>] [--access <public|restricted>]');
  commander.option('--access [access]', 'access');
  commander.option('--tag [tag]', 'tag');
}

async function publish(
  config: Config,
  pkg: any,
  token: string,
  flags: Object,
  dir: string,
): Promise<void> {
  let registry = config.registries.npm.config.registry;

  // validate access argument
  let access = flags.access;
  if (access && access !== 'public' && access !== 'restricted') {
    throw new MessageError(`Invalid argument for access, expected public or restricted`);
  }

  // get tarball stream
  let stat = await fs.lstat(dir);
  let stream;
  if (stat.isDirectory()) {
    stream = await pack(config, dir);
  } else if (stat.isFile()) {
    stream = fs2.createReadStream(dir);
  } else {
    throw new Error("Don't know how to handle this file type");
  }
  invariant(stream, 'expected stream');
  let buffer = await new Promise((resolve, reject) => {
    stream.pipe(
      concat(resolve).on('error', reject),
    );
  });

  // copy normalised package and remove internal keys as they may be sensitive or kpm specific
  pkg = Object.assign({}, pkg);
  for (let key in pkg) {
    if (key[0] === '_') {
      delete pkg[key];
    }
  }

  let tag = flags.tag || 'latest';
  let tbName = `${pkg.name}-${pkg.version}.tgz`;
  let tbURI = `${pkg.name}/-/${tbName}`;

  // create body
  let root = {
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
  pkg.dist.tarball = url.resolve(registry, tbURI).replace(/^https:\/\//, 'http://');

  // publish package
  let res = await config.requestManager.request({
    url: url.resolve(registry, NpmRegistry.escapeName(pkg.name)),
    method: 'PUT',
    body: root,
    headers: {
      authorization: `Bearer ${token}`,
    },
    json: true,
  });
  if (!res.success) {
    throw new MessageError(`Couldn't publish package`);
  }
}

export async function run(
 config: Config,
 reporter: Reporter,
 flags: Object,
 args: Array<string>,
): Promise<void> {
  // validate package fields that are required for publishing
  let pkg = await config.readManifest(config.cwd);
  if (pkg.private) {
    throw new MessageError(`Package marked as private, not publishing`);
  }
  if (!pkg.name) {
    throw new MessageError(`Package doesn't have a name`);
  }

  // validate arguments
  let dir = args[0] || config.cwd;
  if (args.length > 1) {
    throw new MessageError(`Too many arguments, expected max of 1`);
  }
  if (!(await fs.exists(dir))) {
    throw new MessageError("Passed folder/tarball doesn't exist");
  }

  //
  reporter.step(1, 4, 'Bumping version');
  await runVersion(config, reporter, flags, args);

  //
  reporter.step(2, 4, 'Logging in');
  let {token, revoke} = await getToken(config, reporter);

  //
  reporter.step(3, 4, 'Publishing');
  await publish(config, pkg, token, flags, dir);
  reporter.success('Published');

  //
  reporter.step(4, 4, 'Revoking token');
  await revoke();
}
