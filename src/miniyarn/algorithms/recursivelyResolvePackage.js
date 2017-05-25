import Immutable from 'immutable';

import {PackageNode} from 'miniyarn/models/PackageNode';
import {PackageRange} from 'miniyarn/models/PackageRange';
import {PackageResolution} from 'miniyarn/models/PackageResolution';

export async function recursivelyResolvePackage(
  packageInfo,
  {resolver, fetcher, env, peers = true, production = false, tick = () => {}, add = () => {}},
) {
  let dependencyKeys = [`dependencies`];

  if (production === false && packageInfo.devDependencies) dependencyKeys.push(`devDependencies`);

  if (peers === true && packageInfo.peerDependencies) dependencyKeys.push(`peerDependencies`);

  let packageResolution = new PackageResolution(packageInfo.locator);
  let availablePackages = new Immutable.Map(packageInfo.name ? [[packageInfo.name, packageInfo.locator]] : []);

  for (let dependencyKey of dependencyKeys)
    packageResolution = packageResolution.mergeIn([`dependencies`], packageInfo.get(dependencyKey));

  return await performRecursiveResolution(new Immutable.List(), packageResolution, availablePackages);

  // ---

  async function resolvePackage(packageRange) {
    try {
      return [packageRange.name, null, (await resolver.resolve(packageRange, {fetcher, env})).packageResolution];
    } catch (error) {
      return [packageRange, error, null];
    }
  }

  async function performRecursiveResolution(parentPath, packageResolution, availablePackages) {
    let packagePath = parentPath.push(packageResolution.locator);

    // Step 1: We strip the package dependencies from each of its dependencies that are already satisfied by its parents

    packageResolution = packageResolution.update(`dependencies`, dependencies =>
      dependencies.filter(dependencyRange => {
        return (
          !availablePackages.get(dependencyRange.name) ||
          !resolver.isSatisfied(dependencyRange, availablePackages.get(dependencyRange.name), {env})
        );
      }),
    );

    // Step 2: We resolve the package dependencies to satisfiable versions

    let result = await Promise.all(
      packageResolution.dependencies.valueSeq().map(async dependencyRange => {
        return await resolvePackage(dependencyRange);
      }),
    );

    let errors = new Immutable.Map(
      result
        .map(([dependencyRange, error, dependencyResolution]) => {
          return [dependencyRange, error];
        })
        .filter(([key, value]) => value),
    );

    let dependencyResolutions = new Immutable.Map(
      result
        .map(([dependencyName, error, dependencyResolution]) => {
          return [dependencyName, dependencyResolution];
        })
        .filter(([key, value]) => value),
    );

    // Step 3: We make these packages available to their own dependencies

    availablePackages = availablePackages.merge(
      dependencyResolutions.map(dependencyResolution => {
        return dependencyResolution.locator;
      }),
    );

    // Step 4: We now iterate on those dependencies to resolve their own sub-dependencies

    add(dependencyResolutions.size);

    let recursionResults = await Promise.all(
      dependencyResolutions.toList().map(async dependencyResolution => {
        return await performRecursiveResolution(packagePath, dependencyResolution, availablePackages);
      }),
    );

    tick();

    // Step Final: We create our final package node, and return it

    return {
      errors: errors.concat(
        ...recursionResults.map(({errors}) => {
          return errors;
        }),
      ),

      packageTree: new PackageNode(packageResolution.locator).set(
        `dependencies`,
        new Immutable.Map(
          recursionResults.map(({packageTree}) => {
            return [packageTree.name, packageTree];
          }),
        ),
      ),

      treeSize: recursionResults.reduce((accumulator, {treeSize}) => {
        return accumulator + treeSize;
      }, 1),
    };
  }
}
