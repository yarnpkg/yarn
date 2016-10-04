/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {MessageError} from '../../errors.js';
import buildSubCommands from './_build-sub-commands.js';
import {isValidPackageName} from '../../util/normalize-manifest/validate.js';
import {getName} from './dist-tag.js';
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

  let username = args.shift();
  let name = await getName(args, config);
  if (!isValidPackageName(name)) {
    throw new MessageError(reporter.lang('invalidPackageName'));
  }

  let msgs = buildMessages(username, name);
  reporter.step(1, 3, reporter.lang('loggingIn'));
  let revoke = await getToken(config, reporter);

  reporter.step(2, 3, msgs.info);
  let user = await config.registries.npm.request(`-/user/org.couchdb.user:${username}`);
  let error = false;
  if (user) {
    // get package
    let pkg = await config.registries.npm.request(NpmRegistry.escapeName(name));
    if (pkg) {
      pkg.maintainers = pkg.maintainers || [];
      error = mutator({name: user.name, email: user.email}, pkg);
    } else {
      error = true;
      reporter.error("Couldn't find package");
    }

    // update package
    if (pkg && !error) {
      let res = await config.registries.npm.request(`${NpmRegistry.escapeName(name)}/-rev/${pkg._rev}`, {
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
    reporter.error("Couldn't find user");
  }

  reporter.step(3, 3, reporter.lang('revokingToken'));
  await revoke();

  if (error) {
    throw new Error();
  } else {
    return true;
  }
}

export let {run, setFlags} = buildSubCommands('owner', {
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
        info: reporter.lang('addingOwner', username, name),
        success: reporter.lang('addedOwner'),
        error: reporter.lang('addedOwnerFail'),
      }),
      (user: Object, pkg: Object): boolean => {
        for (let owner of pkg.maintainers) {
          if (owner.name === user) {
            reporter.error(reporter.lang('alreadyAnOwner'));
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
        info: `Removing owner ${username} from package ${name}`,
        success: 'Removed owner',
        error: "Couldn't remove owner",
      }),
      (user: Object, pkg: Object): boolean => {
        let found = false;

        pkg.maintainers = pkg.maintainers.filter((o): boolean => {
          let match = o.name === user.name;
          found = found || match;
          return !match;
        });

        if (!found) {
          reporter.error("User isn't an owner of this package");
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

    let name = await getName(args, config);

    reporter.step(1, 3, reporter.lang('loggingIn'));
    let revoke = await getToken(config, reporter);

    reporter.step(2, 3, `Getting owners of package ${name}`);
    let pkg = await config.registries.npm.request(name);
    if (pkg) {
      let owners = pkg.maintainers;
      if (!owners || !owners.length) {
        reporter.warn('No owners');
      } else {
        for (let owner of owners) {
          reporter.info(`${owner.name} <${owner.email}>`);
        }
      }
    } else {
      reporter.error("Couldn't get owners");
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
