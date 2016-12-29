/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {MessageError} from '../../errors.js';
import buildSubCommands from './_build-sub-commands.js';
import {isValidPackageName} from '../../util/normalize-manifest/validate.js';
import {getName} from './tag.js';
import {getToken} from './login.js';
import NpmRegistry from '../../registries/npm-registry.js';

type Messages = {
  info: string,
  success: string,
  error: string,
};

export async function mutate(
  args: Array<string>,
  config: Config,
  reporter: Reporter,
  buildMessages: (username: string, packageName: string) => Messages,
  mutator: (user: Object, pkg: Object) => boolean,
): Promise<boolean> {
  if (args.length !== 2 && args.length !== 1) {
    return false;
  }

  const username = args.shift();
  const name = await getName(args, config);
  if (!isValidPackageName(name)) {
    throw new MessageError(reporter.lang('invalidPackageName'));
  }

  const msgs = buildMessages(username, name);
  reporter.step(1, 3, reporter.lang('loggingIn'));
  const revoke = await getToken(config, reporter, name);

  reporter.step(2, 3, msgs.info);
  const user = await config.registries.npm.request(`-/user/org.couchdb.user:${username}`);
  let error = false;
  if (user) {
    // get package
    const pkg = await config.registries.npm.request(NpmRegistry.escapeName(name));
    if (pkg) {
      pkg.maintainers = pkg.maintainers || [];
      error = mutator({name: user.name, email: user.email}, pkg);
    } else {
      error = true;
      reporter.error(reporter.lang('unknownPackage', name));
    }

    // update package
    if (pkg && !error) {
      const res = await config.registries.npm.request(`${NpmRegistry.escapeName(name)}/-rev/${pkg._rev}`, {
        method: 'PUT',
        body: {
          _id: pkg._id,
          _rev: pkg._rev,
          maintainers: pkg.maintainers,
        },
      });

      if (res != null && res.success) {
        reporter.success(msgs.success);
      } else {
        error = true;
        reporter.error(msgs.error);
      }
    }
  } else {
    error = true;
    reporter.error(reporter.lang('unknownUser', username));
  }

  reporter.step(3, 3, reporter.lang('revokingToken'));
  await revoke();

  if (error) {
    throw new Error();
  } else {
    return true;
  }
}

export const {run, setFlags} = buildSubCommands('owner', {
  add(
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): Promise<boolean> {
    return mutate(
      args,
      config,
      reporter,
      (username: string, name: string): Messages => ({
        info: reporter.lang('ownerAdding', username, name),
        success: reporter.lang('ownerAdded'),
        error: reporter.lang('ownerAddingFailed'),
      }),
      (user: Object, pkg: Object): boolean => {
        for (const owner of pkg.maintainers) {
          if (owner.name === user) {
            reporter.error(reporter.lang('ownerAlready'));
            return true;
          }
        }

        pkg.maintainers.push(user);

        return false;
      },
    );
  },

  rm(
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): Promise<boolean> {
    return mutate(
      args,
      config,
      reporter,
      (username: string, name: string): Messages => ({
        info: reporter.lang('ownerRemoving', username, name),
        success: reporter.lang('ownerRemoved'),
        error: reporter.lang('ownerRemoveError'),
      }),
      (user: Object, pkg: Object): boolean => {
        let found = false;

        pkg.maintainers = pkg.maintainers.filter((o): boolean => {
          const match = o.name === user.name;
          found = found || match;
          return !match;
        });

        if (!found) {
          reporter.error(reporter.lang('userNotAnOwner', user.name));
        }

        return found;
      },
    );
  },

  async ls(
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): Promise<boolean> {
    if (args.length > 1) {
      return false;
    }

    const name = await getName(args, config);

    reporter.step(1, 3, reporter.lang('loggingIn'));
    const revoke = await getToken(config, reporter, name);

    reporter.step(2, 3, reporter.lang('ownerGetting', name));
    const pkg = await config.registries.npm.request(name);
    if (pkg) {
      const owners = pkg.maintainers;
      if (!owners || !owners.length) {
        reporter.warn(reporter.lang('ownerNone'));
      } else {
        for (const owner of owners) {
          reporter.info(`${owner.name} <${owner.email}>`);
        }
      }
    } else {
      reporter.error(reporter.lang('ownerGettingFailed'));
    }

    reporter.step(3, 3, reporter.lang('revokingToken'));
    await revoke();

    if (pkg) {
      return true;
    } else {
      throw new Error();
    }
  },
}, [
  'add <user> [[<@scope>/]<pkg>]',
  'rm <user> [[<@scope>/]<pkg>]',
  'ls [<@scope>/]<pkg>',
]);
