// List of members taken from here: https://www.npmjs.com/package/semver/#functions
// TODO support the `loose` parameter
// TODO support SemVer instances as input parameters
declare module 'semver' {
  declare type Release =
    'major' |
    'premajor' |
    'minor' |
    'preminor' |
    'patch' |
    'prepatch' |
    'prerelease';

  // The supported comparators are taken from the source here:
  // https://github.com/npm/node-semver/blob/8bd070b550db2646362c9883c8d008d32f66a234/semver.js#L623
  declare type Comparator =
    '===' |
    '!==' |
    '==' |
    '=' |
    '' |  // Not sure why you would want this, but whatever.
    '!=' |
    '>' |
    '>=' |
    '<' |
    '<=';

  declare type Options = {
    loose?: boolean,
    includePrerelease?: boolean,
  }

  declare class SemVer {
    loose: ?boolean,
    raw: string,
    major: number,
    minor: number,
    patch: number,
    prerelease: Array<string | number>,
    build: Array<string>,
    version: string,

    constructor(range: string, options?: Options): SemVer | string
  }

  // Functions
  declare function clean(v: string, options?: Options): string | null;
  declare function valid(v: string, options?: Options): string | null;
  declare function inc(v: string, release: string, options?: Options): string | null;
  declare function major(v: string, options?: Options): number;
  declare function minor(v: string, options?: Options): number;
  declare function patch(v: string, options?: Options): number;

  // Comparison
  declare function gt(v1: string, v2: string, options?: Options): boolean;
  declare function gte(v1: string, v2: string, options?: Options): boolean;
  declare function lt(v1: string, v2: string, options?: Options): boolean;
  declare function lte(v1: string, v2: string, options?: Options): boolean;
  declare function eq(v1: string, v2: string, options?: Options): boolean;
  declare function neq(v1: string, v2: string, options?: Options): boolean;
  declare function cmp(v1: string, comparator: Comparator, v2: string): boolean;
  declare function compare(v1: string, v2: string): -1 | 0 | 1;
  declare function rcompare(v1: string, v2: string): -1 | 0 | 1;
  declare function diff(v1: string, v2: string): ?Release;

  // Ranges
  declare function validRange(r: string, options?: Options): string | null;
  declare function satisfies(version: string, range: string, options?: Options): boolean;
  declare function maxSatisfying(versions: Array<string>, range: string, options?: Options): string | null;
  declare function gtr(version: string, range: string): boolean;
  declare function ltr(version: string, range: string): boolean;
  declare function outside(version: string, range: string, hilo: '>' | '<'): boolean;

  // Not explicitly documented
  declare function parse(version: string): ?SemVer;
}
