import Immutable from 'immutable';

import {PackageLocator} from 'miniyarn/models/PackageLocator';
import {PackageRange} from 'miniyarn/models/PackageRange';

function makeDependency([name, reference]) {
  if (reference instanceof PackageRange) {
    return [name, reference];
  } else if (typeof reference === `object`) {
    return [name, new PackageRange(reference)];
  } else {
    return [name, new PackageRange({name, reference})];
  }
}

export class PackageResolution
  extends Immutable.Record({
    name: undefined,

    reference: undefined,

    dependencies: undefined,
  }) {
  constructor(data) {
    data = Immutable.isImmutable(data) ? data.toObject() : {...data};

    if (data.dependencies !== null) data.dependencies = new Immutable.Map(data.dependencies).mapEntries(makeDependency);

    super(data);
  }

  get locator() {
    return new PackageLocator({
      name: this.name,

      reference: this.reference,
    });
  }
}
