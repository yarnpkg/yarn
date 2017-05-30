import {flags} from '@manaflair/concierge';

export default concierge =>
  concierge
    .command(`list [... args]`)
    .alias(`ls`)
    .flag(flags.PROXY_COMMAND | flags.HIDDEN_COMMAND)
    .action(async args => {
      return await concierge.run(null, [`resolve`, `--format=list`, ...args.args], args);
    });
