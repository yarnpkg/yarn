import Immutable from 'immutable';

import {PackageNode} from 'miniyarn/models/PackageNode';

export class YarnLock
  extends (new Immutable.Record({
    dependencies: undefined,
  })) {
  constructor(data) {
    data = Immutable.isImmutable(data) ? data.toObject() : {...data};

    if (data.dependencies != null)
      data.dependencies = new Immutable.Map(data.dependencies).map(dependency => new PackageNode(dependency));

    super(data);
  }
}
