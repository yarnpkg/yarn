/* @flow */

import type {CLIFunctionReturn, CLIFunction} from '../../types.js';
import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import buildSubCommands from './_build-sub-commands.js';
import {getToken} from './login.js';

type TeamParts = {
  scope: string,
  team: string,
  user: string,
};

type CLIFunctionWithParts = (
  parts: TeamParts,
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
) => CLIFunctionReturn;

function explodeScopeTeam(arg: string, requireTeam: boolean, reporter: Reporter): false | TeamParts {
  const [scope, team, ...parts] = arg.split(':');

  if (parts.length) {
    return false;
  }

  if (requireTeam && !team) {
    return false;
  }

  return {
    scope: scope || '',
    team: team || '',
    user: '',
  };
}

function wrapRequired(callback: CLIFunctionWithParts, requireTeam: boolean): CLIFunction {
  return async function(
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): CLIFunctionReturn {
    if (!args.length) {
      return false;
    }

    const parts = explodeScopeTeam(args[0], requireTeam, reporter);
    if (!parts) {
      return false;
    }

    reporter.step(1, 3, reporter.lang('loggingIn'));
    const revoke = await getToken(config, reporter);

    const res = await callback(parts, config, reporter, flags, args);
    if (!res) {
      return res;
    }

    reporter.step(3, 3, reporter.lang('revokingToken'));
    await revoke();
    return true;
  };
}

function wrapRequiredTeam(callback: CLIFunctionWithParts, requireTeam: boolean = true): CLIFunction {
  return wrapRequired(function(
    parts: TeamParts,
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): CLIFunctionReturn {
    if (args.length === 1) {
      return callback(parts, config, reporter, flags, args);
    } else {
      return false;
    }
  }, requireTeam);
}

function wrapRequiredUser(callback: CLIFunctionWithParts): CLIFunction {
  return wrapRequired(function(
    parts: TeamParts,
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): CLIFunctionReturn {
    if (args.length === 2) {
      return callback({
        user: args[1],
        ...parts,
      }, config, reporter, flags, args);
    } else {
      return false;
    }
  }, true);
}

export const {run, setFlags} = buildSubCommands('team', {
  create: wrapRequiredTeam(async function(
    parts: TeamParts,
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): Promise<boolean> {
    reporter.step(2, 3, reporter.lang('teamCreating'));
    reporter.inspect(await config.registries.npm.request(`team/${parts.scope}`, {
      method: 'PUT',
      body: {
        team: parts.team,
      },
    }));
    return true;
  }),

  destroy: wrapRequiredTeam(async function(
    parts: TeamParts,
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): Promise<boolean> {
    reporter.step(2, 3, reporter.lang('teamRemoving'));
    reporter.inspect(await config.registries.npm.request(`team/${parts.scope}/${parts.team}`, {
      method: 'DELETE',
    }));
    return true;
  }),

  add: wrapRequiredUser(async function(
    parts: TeamParts,
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): Promise<boolean> {
    reporter.step(2, 3, reporter.lang('teamAddingUser'));
    reporter.inspect(await config.registries.npm.request(`team/${parts.scope}/${parts.team}/user`, {
      method: 'PUT',
      body: {
        user: parts.user,
      },
    }));
    return true;
  }),

  rm: wrapRequiredUser(async function(
    parts: TeamParts,
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): Promise<boolean> {
    reporter.step(2, 3, reporter.lang('teamRemovingUser'));
    reporter.inspect(await config.registries.npm.request(`team/${parts.scope}/${parts.team}/user`, {
      method: 'DELETE',
      body: {
        user: parts.user,
      },
    }));
    return true;
  }),

  ls: wrapRequiredTeam(async function(
    parts: TeamParts,
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): Promise<boolean> {
    reporter.step(2, 3, reporter.lang('teamListing'));
    const uriParams = '?format=cli';
    if (parts.team) {
      reporter.inspect(
        await config.registries.npm.request(`team/${parts.scope}/${parts.team}/user${uriParams}`),
      );
    } else {
      reporter.inspect(
        await config.registries.npm.request(`org/${parts.scope}/team${uriParams}`),
      );
    }
    return true;
  }, false),
}, [
  'team create <scope:team>',
  'team destroy <scope:team>',
  'team add <scope:team> <user>',
  'team rm <scope:team> <user>',
  'team ls <scope>|<scope:team>',
]);
