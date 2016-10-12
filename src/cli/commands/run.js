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
import {execCommand} from './_execute-lifecycle-script.js';
import {MessageError} from '../../errors.js';
import {registries} from '../../resolvers/index.js';
import * as fs from '../../util/fs.js';
import map from '../../util/map.js';

const leven = require('leven');
const path = require('path');

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  // build up a list of possible scripts
  const pkg = await config.readManifest(config.cwd);
  const scripts = map();
  const binCommands = [];
  let pkgCommands = [];
  for (const registry of Object.keys(registries)) {
    const binFolder = path.join(config.cwd, config.registries[registry].folder, '.bin');
    if (await fs.exists(binFolder)) {
      for (const name of await fs.readdir(binFolder)) {
        binCommands.push(name);
        scripts[name] = `"${path.join(binFolder, name)}"`;
      }
    }
  }
  if (pkg.scripts) {
    // inherit `scripts` from manifest
    pkgCommands = Object.keys(pkg.scripts);
    Object.assign(scripts, pkg.scripts);
  }

  const runCommand = async (args) => {
    const action = args.shift();
    const actions = [`pre${action}`, action, `post${action}`];

    // build up list of commands
    const cmds = [];
    for (const action of actions) {
      const cmd = scripts[action];
      if (cmd) {
        cmds.push([action, cmd]);
      }
    }

    if (cmds.length) {
      for (const [stage, cmd] of cmds) {
        await execCommand(stage, config, `${cmd} ${args.join(' ')}`, config.cwd);
      }
    } else {
      let suggestion;

      for (const commandName in scripts) {
        const steps = leven(commandName, action);
        if (steps < 2) {
          suggestion = commandName;
        }
      }

      let msg = `Command ${JSON.stringify(action)} not found.`;
      if (suggestion) {
        msg += ` Did you mean ${JSON.stringify(suggestion)}?`;
      }
      throw new MessageError(msg);
    }
  };

  // list possible scripts if none specified
  if (args.length === 0) {
    reporter.error(reporter.lang('commandNotSpecified'));
    reporter.info(`${reporter.lang('binCommands') + binCommands.join(', ')}`);
    reporter.info(`${reporter.lang('possibleCommands')}`);
    reporter.list('possibleCommands', pkgCommands.sort());
    await reporter.question(reporter.lang('commandQuestion')).then(
      (answer) => runCommand(answer.split(' ')),
      () => reporter.error(reporter.lang('commandNotSpecified')),
    );
    return Promise.resolve();
  } else {
    return await runCommand(args);
  }
}
