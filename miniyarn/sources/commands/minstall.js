import { UsageError } from '@manaflair/concierge';

export default concierge => concierge

    .command(`minstall`)
    .describe(`Like mcheck, but then run an install if needed`)

    .action(async (args) => {

        throw new UsageError(`This command is special and must be called without any argument`);

    })

;
