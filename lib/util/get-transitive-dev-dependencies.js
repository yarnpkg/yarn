'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getTransitiveDevDependencies = getTransitiveDevDependencies;
function dependenciesObjectToPatterns(dependencies) {
  if (!dependencies) {
    return [];
  }
  return Object.keys(dependencies).map(name => `${name}@${(dependencies || {})[name]}`);
}

// Enumerate all the transitive dependencies of a set of top-level packages
function getTransitiveDependencies(lockfile, roots) {
  // Queue of dependency patterns to visit; set of already-visited patterns
  const queue = [];
  const patterns = new Set();

  const enqueue = pattern => {
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

function setDifference(x, y) {
  return new Set([...x].filter(value => !y.has(value)));
}

// Given a manifest, an optional workspace layout, and a lockfile, enumerate
// all package versions that:
// i) are present in the lockfile
// ii) are a transitive dependency of some top-level devDependency
// iii) are not a transitive dependency of some top-level production dependency
function getTransitiveDevDependencies(packageManifest, workspaceLayout, lockfile) {
  // Enumerate the top-level package manifest as well as any workspace manifests
  const manifests = [packageManifest];
  if (workspaceLayout) {
    for (var _iterator = Object.keys(workspaceLayout.workspaces), _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
      var _ref;

      if (_isArray) {
        if (_i >= _iterator.length) break;
        _ref = _iterator[_i++];
      } else {
        _i = _iterator.next();
        if (_i.done) break;
        _ref = _i.value;
      }

      const name = _ref;

      manifests.push(workspaceLayout.workspaces[name].manifest);
    }
  }

  // Collect all the top-level production and development dependencies across all manifests
  let productionRoots = [];
  let developmentRoots = [];
  for (var _iterator2 = manifests, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
    var _ref2;

    if (_isArray2) {
      if (_i2 >= _iterator2.length) break;
      _ref2 = _iterator2[_i2++];
    } else {
      _i2 = _iterator2.next();
      if (_i2.done) break;
      _ref2 = _i2.value;
    }

    const manifest = _ref2;

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