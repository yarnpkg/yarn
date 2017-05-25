import { UsageError } from '@manaflair/concierge';

export default concierge => concierge

    .command(`mcheck`)
    .describe(`A minimal but very fast integrity check`)

    .action(async (args) => {

        throw new UsageError(`This command is special and must be called without any argument`);

    })

;
