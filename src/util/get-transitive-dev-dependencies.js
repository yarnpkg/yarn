/* @flow */

import type Lockfile from '../lockfile';
import type WorkspaceLayout from '../workspace-layout';

function dependenciesObjectToPatterns(dependencies: ?Object): Array<string> {
  if (!dependencies) {
    return [];
  }
  return Object.keys(dependencies).map(name => `${name}@${(dependencies || {})[name]}`);
}

// Enumerate all the transitive dependencies of a set of top-level packages
function getTransitiveDependencies(lockfile: Lockfile, roots: Array<string>): Set<string> {
  // Queue of dependency patterns to visit; set of already-visited patterns
  const queue = [];
  const patterns = new Set();

  const enqueue = (pattern: string) => {
    if (patterns.has(pattern)) {
      return;
    }
    patterns.add(pattern);
    queue.push(pattern);
  };

  roots.forEach(enqueue);

  // Final result set
  const transitiveDependencies = new Set();

  while (queue.length > 0) {
    const pattern = queue.shift();
    const lockManifest = lockfile.getLocked(pattern);

    if (!lockManifest) {
      continue;
    }

    // Add the dependency to the result set
    transitiveDependencies.add(`${lockManifest.name}@${lockManifest.version}`);

    // Enqueue any dependencies of the dependency for processing

    const dependencyPatterns = dependenciesObjectToPatterns(lockManifest.dependencies);
    dependencyPatterns.forEach(enqueue);

    const optionalDependencyPatterns = dependenciesObjectToPatterns(lockManifest.optionalDependencies);
    optionalDependencyPatterns.forEach(enqueue);
  }

  return transitiveDependencies;
}

function setDifference<T>(x: Set<T>, y: Set<T>): Set<T> {
  return new Set([...x].filter(value => !y.has(value)));
}

// Given a manifest, an optional workspace layout, and a lockfile, enumerate
// all package versions that:
// i) are present in the lockfile
// ii) are a transitive dependency of some top-level devDependency
// iii) are not a transitive dependency of some top-level production dependency
export function getTransitiveDevDependencies(
  packageManifest: Object,
  workspaceLayout: ?WorkspaceLayout,
  lockfile: Lockfile,
): Set<string> {
  // Enumerate the top-level package manifest as well as any workspace manifests
  const manifests = [packageManifest];
  if (workspaceLayout) {
    for (const name of Object.keys(workspaceLayout.workspaces)) {
      manifests.push(workspaceLayout.workspaces[name].manifest);
    }
  }

  // Collect all the top-level production and development dependencies across all manifests
  let productionRoots = [];
  let developmentRoots = [];
  for (const manifest of manifests) {
    productionRoots = productionRoots.concat(dependenciesObjectToPatterns(manifest.dependencies));
    productionRoots = productionRoots.concat(dependenciesObjectToPatterns(manifest.optionalDependencies));
    developmentRoots = developmentRoots.concat(dependenciesObjectToPatterns(manifest.devDependencies));
  }

  // Enumerate all the transitive production and development dependencies
  const productionDependencies = getTransitiveDependencies(lockfile, productionRoots);
  const developmentDependencies = getTransitiveDependencies(lockfile, developmentRoots);

  // Exclude any development dependencies that are also production dependencies
  return setDifference(developmentDependencies, productionDependencies);
}
