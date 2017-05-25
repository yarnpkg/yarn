import { BaseFetcher } from 'miniyarn/fetchers/BaseFetcher';

export function makeTransformFetcher(Fetcher, { supports, transformReference }) {

    return class TransformFetcher extends BaseFetcher {

        constructor(options) {

            super();

            this.fetcher = new Fetcher(options);

        }

        supports(packageLocator, { env }) {

            return supports(packageLocator, { env });

        }

        async fetch(packageLocator, { fetcher, env }) {

            let transformedLocator = packageLocator.merge({ reference: transformReference(packageLocator, { env }) });

            if (!this.fetcher.supports(transformedLocator, { env }))
                throw new Error(`The transformed locator isn't supported by the target fetcher`);

            return await this.fetcher.fetch(transformedLocator, { fetcher, env });

        }

    };

}
