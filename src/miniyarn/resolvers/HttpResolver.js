import Immutable             from 'immutable';
import normalizeUrl          from 'normalize-url';
import Url                   from 'url';

import { PackageLocator }    from 'miniyarn/models/PackageLocator';
import { PackageResolution } from 'miniyarn/models/PackageResolution';
import { BaseResolver }      from 'miniyarn/resolvers/BaseResolver';

export class HttpResolver extends BaseResolver {

    supports(packageRange, { env }) {

        if (!packageRange.reference)
            return false;

        let parse = Url.parse(packageRange.reference);

        if (![ `http:`, `https:` ].includes(parse.protocol))
            return false;

        if (!parse.host || !parse.path)
            return false;

        if (parse.path.endsWith(`.git`))
            return false;

        return true;

    }

    isSatisfied(packageRange, availableLocator, { env }) {

        return this.normalize(packageRange.reference) === availableLocator.reference;

    }

    async getCandidates(packageRange, { env }) {

        return new Immutable.Set([ this.normalize(packageRange.reference) ]);

    }

    async resolve(packageRange, { fetcher, env }) {

        let { packageInfo } = await fetcher.fetch(new PackageLocator({ name: packageRange.name, reference: packageRange.reference }), { env });

        return { packageResolution: new PackageResolution({ name: packageRange.name, reference: packageRange.reference, dependencies: packageInfo.dependencies }) };

    }

    normalize(packageReference) {

        return normalizeUrl(packageReference);

    }

}
