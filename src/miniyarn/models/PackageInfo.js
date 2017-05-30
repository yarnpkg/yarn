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

export class PackageInfo
  extends Immutable.Record({
    name: undefined,

    reference: undefined,

    dependencies: undefined,
    devDependencies: undefined,
    peerDependencies: undefined,
    bundledDependencies: undefined,

    versions: undefined,
    version: undefined,

    description: undefined,
    keywords: undefined,

    author: undefined,
    contributors: undefined,
    license: undefined,

    bin: undefined,
    scripts: undefined,

    main: undefined,
    browser: undefined,

    files: undefined,

    directories: undefined,
  }) {
  constructor(data) {
    data = Immutable.isImmutable(data) ? data.toObject() : {...data};

    if (data.dependencies !== null) data.dependencies = new Immutable.Map(data.dependencies).mapEntries(makeDependency);

    if (data.devDependencies !== null)
      data.devDependencies = new Immutable.Map(data.devDependencies).mapEntries(makeDependency);

    if (data.peerDependencies !== null)
      data.peerDependencies = new Immutable.Map(data.peerDependencies).mapEntries(makeDependency);

    if (data.bundledDependencies !== null) data.bundledDependencies = new Immutable.Set(data.bundledDependencies);

    if (data.versions !== null) data.versions = new Immutable.Set(data.versions);

    if (data.keywords !== null) data.keywords = new Immutable.Set(data.keywords);

    if (data.contributors !== null) data.contributors = new Immutable.Set(data.contributors);

    if (typeof data.bin === `string`) data.bin = new Immutable.Map([[data.name, data.bin]]);
    else if (data.bin !== null) data.bin = new Immutable.Map(data.bin);

    if (data.scripts !== null) data.scripts = new Immutable.Map(data.scripts);

    if (data.files !== null) data.files = new Immutable.Set(data.files);

    if (data.directories !== null) data.directories = new Immutable.Map(data.directories);

    super(data);
  }

  get locator() {
    return new PackageLocator({
      name: this.name,

      reference: this.reference,
    });
  }
}
