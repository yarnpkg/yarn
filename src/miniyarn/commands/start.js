import {flags} from '@manaflair/concierge';

export default concierge =>
  concierge
    .command(`start [... args]`)
    .describe(`Run the project start script, if available`)
    .flag(flags.PROXY_COMMAND)
    .action(async args => {
      return await concierge.run(null, [`run`, `start`, ...args.args], args);
    });
