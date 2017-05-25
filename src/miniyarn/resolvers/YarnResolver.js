import Immutable             from 'immutable';
import invariant             from 'invariant';
import semver                from 'semver';
import Url                   from 'url';

import { BaseResolver }      from 'miniyarn/resolvers/BaseResolver';
import { Environment }       from 'miniyarn/models/Environment';
import { PackageLocator }    from 'miniyarn/models/PackageLocator';
import { PackageResolution } from 'miniyarn/models/PackageResolution';
import * as httpUtils        from 'miniyarn/utils/http';
import * as parseUtils       from 'miniyarn/utils/parse';
import * as streamUtils      from 'miniyarn/utils/stream';
import * as yarnUtils        from 'miniyarn/utils/yarn';

export class YarnResolver extends BaseResolver {

    supports(packageRange, { env }) {

        if (!packageRange.name || !packageRange.reference)
            return false;

        return semver.validRange(packageRange.reference);

    }

    isSatisfied(packageRange, packageLocator, { env }) {

        return semver.satisfies(packageLocator.reference, packageRange.reference);

    }

    async getCandidates(packageRange, { env }) {

        if (!semver.validRange(packageRange.reference))
            throw new Error(`Invalid reference "${packageRange.reference}" for package "${packageRange.name}"`);

        if (semver.valid(packageRange.reference))
            return new Immutable.List([ packageRange.reference ]);

        let httpResponse = await httpUtils.get(this.getPackageUrl(packageRange, { env }), { cache: true });

        let versions = Reflect.ownKeys(parseUtils.parseJson(await streamUtils.readStream(httpResponse)).versions);
        let candidates = versions.filter(version => semver.satisfies(version, packageRange.reference));

        return new Immutable.Set(candidates);

    }

    async resolve(packageRange, { env }) {

        let packageLocator = !semver.valid(packageRange.reference) && semver.validRange(packageRange.reference)
            ? new PackageLocator({ name: packageRange.name, reference: await this.resolveReference(packageRange, { env }) })
            : new PackageLocator({ name: packageRange.name, reference: packageRange.reference });

        if (!semver.valid(packageLocator.reference))
            throw new Error(`Invalid reference "${packageLocator.reference}" for package "${packageLocator.name}"`);

        return { packageResolution: await this.resolvePackage(packageLocator, { env }) };

    }

    async resolveReference(packageRange, { env }) {

        let candidates = await this.getCandidates(packageRange, { env });

        return semver.maxSatisfying(Array.from(candidates), packageRange.reference);

    }

    async resolvePackage(packageLocator, { env }) {

        let httpResponse = await httpUtils.get(this.getPackageUrl(packageLocator, { env }), { cache: true });
        let registryData = parseUtils.parseJson(await streamUtils.readStream(httpResponse));

        if (!Object.prototype.hasOwnProperty.call(registryData, `versions`))
            throw new Error(`Registry returned invalid data`);

        if (!Object.prototype.hasOwnProperty.call(registryData.versions, packageLocator.reference))
            throw new Error(`Registry failed to return reference "${packageLocator.reference}"`);

        let dependencies = registryData.versions[packageLocator.reference].dependencies;

        return new PackageResolution({ dependencies }).merge(packageLocator);

    }

    getPackageUrl(packageLocator, { env }) {

        invariant(packageLocator.name, `This package locator should have a name`);
        invariant(packageLocator.reference, `This package locator should have a reference`);

        let { scope, localName } = yarnUtils.parseIdentifier(packageLocator.name);

        if (scope) {
            return Url.resolve(env.REGISTRY_URL, `/@${scope}%2f${localName}`);
        } else {
            return Url.resolve(env.REGISTRY_URL, `/${localName}`);
        }

    }

}
