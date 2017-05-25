import {flags} from '@manaflair/concierge';

export default concierge =>
  concierge
    .command(`test [... args]`)
    .describe(`Run the project tests, if available`)
    .flag(flags.PROXY_COMMAND)
    .action(async args => {
      return await concierge.run(null, [`run`, `test`, ...args.args], args);
    });
