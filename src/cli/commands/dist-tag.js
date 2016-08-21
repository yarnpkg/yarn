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
import PackageRequest from '../../PackageRequest.js';
import buildSubCommands from './_build-sub-commands.js';
import {getToken} from './login.js';
import NpmRegistry from '../../registries/NpmRegistry.js';
import {MessageError} from '../../errors.js';
import {isValidPackageName} from '../../util/normalise-manifest/validate.js';

export async function getName(args: Array<string>, config: Config): Promise<string> {
  let name = args.shift();

  if (!name) {
    let pkg = await config.readManifest(config.cwd);
    name = pkg.name;
  }

  if (name) {
    if (!isValidPackageName(name)) {
      throw new MessageError('Invalid package name');
    }

    return NpmRegistry.escapeName(name);
  } else {
    throw new MessageError("Couldn't find package name");
  }
}

export let {run, setFlags} = buildSubCommands('dist-tag', {
  async add(
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): Promise<boolean> {
    if (args.length !== 2) {
      return false;
    }

    const {name, range, hasVersion} = PackageRequest.normalisePattern(args.shift());
    if (!hasVersion) {
      throw new MessageError('required version in range');
    }
    if (!isValidPackageName(name)) {
      throw new MessageError('invalid package name');
    }

    const tag = args.shift();

    reporter.step(1, 3, 'Logging in');
    let revoke = await getToken(config, reporter);

    reporter.step(2, 3, `Creating tag ${tag} = ${range}`);
    let result = await config.registries.npm.request(`-/package/${name}/dist-tags/${tag}`, {
      method: 'PUT',
      body: range,
    });

    if (result.ok) {
      reporter.success('Created tag');
    } else {
      reporter.error("Couldn't add tag");
    }

    reporter.step(3, 3, 'Revoking token');
    await revoke();

    if (result.ok) {
      return true;
    } else {
      return Promise.reject();
    }
  },

  async rm(
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): Promise<boolean> {
    if (args.length !== 2) {
      return false;
    }

    const name = await getName(args, config);
    const tag = args.shift();

    reporter.step(1, 3, 'Logging in');
    let revoke = await getToken(config, reporter);

    reporter.step(2, 3, 'Deleting tag');
    const result = await config.registries.npm.request(`-/package/${name}/dist-tags/${tag}`, {
      method: 'DELETE',
    });

    if (result === false) {
      reporter.error("Couldn't delete tag");
    } else {
      reporter.success('Deleted tag');
    }

    reporter.step(3, 3, 'Revoking token');
    await revoke();

    if (result === false) {
      return Promise.reject();
    } else {
      return true;
    }
  },

  async ls(
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): Promise<void> {
    reporter.step(1, 3, 'Logging in');
    let revoke = await getToken(config, reporter);

    reporter.step(2, 3, 'Getting tags');
    const name = await getName(args, config);
    const tags = await config.registries.npm.request(`-/package/${name}/dist-tags`);

    if (tags) {
      reporter.info(`Package ${name}`);
      for (let name in tags) {
        reporter.info(`${name}: ${tags[name]}`);
      }
    }

    reporter.step(3, 3, 'Revoking token');
    await revoke();

    if (!tags) {
      throw new MessageError("Couldn't find this package on the registry");
    }
  },
}, [
  'add <pkg>@<version> [<tag>]',
  'rm <pkg> <tag>',
  'ls [<pkg>]',
]);
