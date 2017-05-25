import { flags } from '@manaflair/concierge';

export default concierge => concierge

    .command(`build [... args]`)
    .describe(`Run the project build script, if available`)
    .flag(flags.PROXY_COMMAND)

    .action(async (args) => {

        return await concierge.run(null, [ `run`, `build`, ... args.args ], args);

    })

;
