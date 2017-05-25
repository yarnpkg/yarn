import Immutable         from 'immutable';

import * as promiseUtils from 'miniyarn/utils/promise';

export async function fetchAllPackages(packageLocators, { fetcher, env, limit = async (fn) => await fn(), tick = () => {} }) {

    let packageInfos = [];
    let handlers = [];
    let errors = [];

    await Promise.all(packageLocators.map(async (packageLocator) => await limit(async () => {

        try {

            let fetch = fetcher.fetch(packageLocator, { env });
            let timeout = promiseUtils.timeout(env.FETCH_TIMEOUT);

            let { packageInfo, handler } = await Promise.race([ fetch, timeout ]);

            packageInfos.push([ packageLocator, packageInfo ]);
            handlers.push([ packageLocator, handler ]);

        } catch (error) {

            errors.push([ packageLocator, error ]);

        } finally {

            tick();

        }

    })));

    return {
        packageInfos: new Immutable.Map(packageInfos),
        handlers: new Immutable.Map(handlers),
        errors: new Immutable.Map(errors),
    };

}
