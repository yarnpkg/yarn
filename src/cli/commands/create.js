import type Config from '../../config.js';
import {MessageError} from '../../errors.js';
import type {Reporter} from '../../reporters/index.js';
import {spawn} from '../../util/child.js';
import {run as runGlobal, getBinFolder as getGlobalBinFolder} from './global.js';
import {run as runRun} from './run.js';

export function setFlags() {}

export function hasWrapper(): boolean {
  return true;
}

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  const [builderName, ... rest] = args;

  if (!builderName) {
    throw new MessageError(reporter.lang('invalidPackageName'));
  }

  if (builderName.match(/^@/)) {
    throw new MessageError(reporter.lang('createUnsupportedScope'));
  }

  await runGlobal(config, reporter, {}, [ 'add', `yarn-create-${builderName}` ]);
  await spawn(`${getGlobalBinFolder(config, flags)}/yarn-create-${builderName}`, rest, { stdio: `inherit` });
}
