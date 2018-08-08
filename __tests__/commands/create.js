// @flow

import {parsePackageName, coerceCreatePackageName} from '../../src/cli/commands/create';

describe(`parsePackageName`, () => {
  test('invalid', () => {
    expect(() => {
      parsePackageName('@/name');
    }).toThrowError(`Scope should not be empty, got "@/name"`);
    expect(() => {
      parsePackageName('/name');
    }).toThrowError(`Name should not start with "/", got "/name"`);
    expect(() => {
      parsePackageName('./name');
    }).toThrowError(`Name should not start with ".", got "./name"`);
  });

  test('basic', () => {
    expect(parsePackageName('name')).toEqual({
      fullName: 'name',
      name: 'name',
      scope: '',
      path: '',
      full: 'name',
    });
    expect(parsePackageName('@scope/name')).toEqual({
      fullName: '@scope/name',
      name: 'name',
      scope: '@scope',
      path: '',
      full: '@scope/name',
    });
    expect(parsePackageName('@scope/name/path/to/file.js')).toEqual({
      fullName: '@scope/name',
      name: 'name',
      scope: '@scope',
      path: 'path/to/file.js',
      full: '@scope/name/path/to/file.js',
    });
  });

  test('without name', () => {
    expect(parsePackageName('@scope/')).toEqual({
      fullName: '@scope',
      name: '',
      scope: '@scope',
      path: '',
      full: '@scope',
    });
    expect(parsePackageName('@scope')).toEqual({
      fullName: '@scope',
      name: '',
      scope: '@scope',
      path: '',
      full: '@scope',
    });
  });
});

describe(`coerceCreatePackageName`, () => {
  test('invalid', () => {
    expect(() => {
      coerceCreatePackageName('@/name');
    }).toThrow();
    expect(() => {
      coerceCreatePackageName('/name');
    }).toThrow();
    expect(() => {
      coerceCreatePackageName('./name');
    }).toThrow();
  });

  test('basic', () => {
    expect(coerceCreatePackageName('name')).toEqual({
      fullName: 'create-name',
      name: 'create-name',
      scope: '',
      path: '',
      full: 'create-name',
    });
    expect(coerceCreatePackageName('@scope/name')).toEqual({
      fullName: '@scope/create-name',
      name: 'create-name',
      scope: '@scope',
      path: '',
      full: '@scope/create-name',
    });
    expect(coerceCreatePackageName('@scope/name/path/to/file.js')).toEqual({
      fullName: '@scope/create-name',
      name: 'create-name',
      scope: '@scope',
      path: 'path/to/file.js',
      full: '@scope/create-name/path/to/file.js',
    });
  });

  test('not postfixing with "-" if name is emptu', () => {
    expect(coerceCreatePackageName('@scope/').fullName).toEqual('@scope/create');
    expect(coerceCreatePackageName('@scope').fullName).toEqual('@scope/create');
  });
});
