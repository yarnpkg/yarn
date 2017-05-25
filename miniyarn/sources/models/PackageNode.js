import Immutable          from 'immutable';

import { PackageLocator } from 'miniyarn/models/PackageLocator';

function makeDependency([ name, reference ]) {

    if (reference instanceof PackageNode) {
        return [ name, reference ];
    } else if (typeof reference === `object`) {
        return [ name, new PackageNode(reference) ];
    }

}

export class PackageNode extends Immutable.Record({

    name: undefined,

    reference: undefined,

    dependencies: new Immutable.Map(),

}) {

    constructor(data) {

        data = Immutable.isImmutable(data) ? data.toObject() : { ... data };

        if (data.dependencies !== null)
            data.dependencies = new Immutable.Map(data.dependencies).mapEntries(makeDependency);

        super(data);

    }

    get locator() {

        return new PackageLocator({

            name: this.name,

            reference: this.reference,

        });

    }

}
