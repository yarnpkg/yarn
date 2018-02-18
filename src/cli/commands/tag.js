/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import buildSubCommands from './_build-sub-commands.js';
import {getToken} from './login.js';
import NpmRegistry from '../../registries/npm-registry.js';
import {MessageError} from '../../errors.js';
import {normalizePattern} from '../../util/normalize-pattern.js';
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

async function list(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  const name = await getName(args, config);

  reporter.step(1, 1, reporter.lang('gettingTags'));
  const tags = await config.registries.npm.request(`-/package/${name}/dist-tags`);

  if (tags) {
    reporter.info(`Package ${name}`);
    for (const name in tags) {
      reporter.info(`${name}: ${tags[name]}`);
    }
  }

  if (!tags) {
    throw new MessageError(reporter.lang('packageNotFoundRegistry', name, 'npm'));
  }
}

async function remove(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<boolean> {
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
}

export function setFlags(commander: Object) {
  commander.description('Add, remove, or list tags on a package.');
}

export const {run, hasWrapper, examples} = buildSubCommands(
  'tag',
  {
    async add(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<boolean> {
      if (args.length !== 2) {
        return false;
      }

      const {name, range, hasVersion} = normalizePattern(args.shift());
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

    async rm(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
      reporter.warn(`\`yarn tag rm\` is deprecated. Please use \`yarn tag remove\`.`);
      await remove(config, reporter, flags, args);
    },

    async remove(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
      await remove(config, reporter, flags, args);
    },

    async ls(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
      reporter.warn(`\`yarn tag ls\` is deprecated. Please use \`yarn tag list\`.`);
      await list(config, reporter, flags, args);
    },

    async list(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
      await list(config, reporter, flags, args);
    },
  },
  ['add <pkg>@<version> [<tag>]', 'remove <pkg> <tag>', 'list [<pkg>]'],
);
