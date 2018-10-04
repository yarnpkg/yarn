// @flow
import {diffWithUnstable} from './semver';

export const categorizeDependencies = function(dependencies: Array<Object>): Object {
  const major = [];
  const minor = [];
  const patch = [];
  const other = [];

  dependencies.map(dependency => {
    if (dependency.name !== 'eslint-plugin-yarn-internal') {
      const outdatedLevel = diffWithUnstable(dependency.current, dependency.latest);

      switch (outdatedLevel) {
        case 'major':
          major.push(dependency);
          break;
        case 'minor':
          minor.push(dependency);
          break;
        case 'patch':
          patch.push(dependency);
          break;
        default:
          other.push(dependency);
      }
    }
  });

  return {
    major,
    minor,
    patch,
    other,
  };
};
