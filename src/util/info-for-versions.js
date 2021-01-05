/* @flow */
import {VERSION_COLOR_SCHEME, VERSION_SYMBOL_MAP} from '../constants.js';
import type {VersionColor, VersionSymbol} from '../constants.js';
import {getVersionBump} from './semver.js';

export function colorForVersions(from: string, to: string): VersionColor {
  return VERSION_COLOR_SCHEME[getVersionBump(from, to)];
}

export function symbolForVersions(from: string, to: string): VersionSymbol {
  return VERSION_SYMBOL_MAP[getVersionBump(from, to)];
}
