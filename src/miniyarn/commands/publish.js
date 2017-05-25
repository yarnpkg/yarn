import * as fsUtils from 'miniyarn/utils/fs';

export default concierge =>
  concierge.command(`publish`).describe(`Send the current package to the release registry`).action(async args => {
    let temporaryFile = await fsUtils.createTemporaryFile();

    let packExitCode = await concierge.run(null, [`pack`, `--output`, temporaryFile]);

    if (packExitCode !== 0) return packExitCode;

    throw new Error(`Unimplemented`);
  });
