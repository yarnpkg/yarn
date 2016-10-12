/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import PackageRequest from '../../package-request.js';
import buildSubCommands from './_build-sub-commands.js';
import {getToken} from './login.js';
import NpmRegistry from '../../registries/npm-registry.js';
import {MessageError} from '../../errors.js';
import {isValidPackageName} from '../../util/normalize-manifest/validate.js';

export async function getName(args: Array<string>, config: Config): Promise<string> {
  let name = args.shift();

  if (!name) {
    const pkg = await config.readRootManifest();
    name = pkg.name;
  }

  if (name) {
    if (!isValidPackageName(name)) {
      throw new MessageError(config.reporter.lang('invalidPackageName'));
    }

    return NpmRegistry.escapeName(name);
  } else {
    throw new MessageError(config.reporter.lang('unknownPackageName'));
  }
}

export const {run, setFlags, examples} = buildSubCommands('tag', {
  async add(
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): Promise<boolean> {
    if (args.length !== 2) {
      return false;
    }

    const {name, range, hasVersion} = PackageRequest.normalizePattern(args.shift());
    if (!hasVersion) {
      throw new MessageError(reporter.lang('requiredVersionInRange'));
    }
    if (!isValidPackageName(name)) {
      throw new MessageError(reporter.lang('invalidPackageName'));
    }

    const tag = args.shift();

    reporter.step(1, 3, reporter.lang('loggingIn'));
    const revoke = await getToken(config, reporter, name);

    reporter.step(2, 3, reporter.lang('creatingTag', tag, range));
    const result = await config.registries.npm.request(
      `-/package/${NpmRegistry.escapeName(name)}/dist-tags/${encodeURI(tag)}`,
      {
        method: 'PUT',
        body: range,
      },
    );

    if (result != null && result.ok) {
      reporter.success(reporter.lang('createdTag'));
    } else {
      reporter.error(reporter.lang('createdTagFail'));
    }

    reporter.step(3, 3, reporter.lang('revokingToken'));
    await revoke();

    if (result != null && result.ok) {
      return true;
    } else {
      throw new Error();
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

    reporter.step(1, 3, reporter.lang('loggingIn'));
    const revoke = await getToken(config, reporter, name);

    reporter.step(2, 3, reporter.lang('deletingTags'));
    const result = await config.registries.npm.request(`-/package/${name}/dist-tags/${encodeURI(tag)}`, {
      method: 'DELETE',
    });

    if (result === false) {
      reporter.error(reporter.lang('deletedTagFail'));
    } else {
      reporter.success(reporter.lang('deletedTag'));
    }

    reporter.step(3, 3, reporter.lang('revokingToken'));
    await revoke();

    if (result === false) {
      throw new Error();
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
    reporter.step(1, 3, reporter.lang('loggingIn'));
    const revoke = await getToken(config, reporter, name);

    reporter.step(2, 3, reporter.lang('gettingTags'));
    const name = await getName(args, config);
    const tags = await config.registries.npm.request(`-/package/${name}/dist-tags`);

    if (tags) {
      reporter.info(`Package ${name}`);
      for (const name in tags) {
        reporter.info(`${name}: ${tags[name]}`);
      }
    }

    reporter.step(3, 3, reporter.lang('revokingToken'));
    await revoke();

    if (!tags) {
      throw new MessageError(reporter.lang('packageNotFoundRegistry', name, 'npm'));
    }
  },
}, [
  'add <pkg>@<version> [<tag>]',
  'rm <pkg> <tag>',
  'ls [<pkg>]',
]);
