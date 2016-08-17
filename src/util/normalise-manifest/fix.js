/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

import {normalisePerson, extractDescription} from './util.js';
import {hostedGitFragmentToGitUrl} from '../../resolvers/index.js';
import inferLicense from './infer-license.js';
import * as fs from '../fs.js';

const semver = require('semver');
const path = require('path');
const url = require('url');
const _ = require('lodash');

export default async function (info: Object, moduleLoc: string): Promise<void> {
  const files = await fs.readdir(moduleLoc);

  // clean info.version
  if (typeof info.version === 'string' && !semver.valid(info.version)) {
    info.version = semver.clean(info.version);
  }

  // if name or version aren't set then set them to empty strings
  info.name = info.name || '';
  info.version = info.version || '';

  // if the man field is a string then coerce it to an array
  if (typeof info.man === 'string') {
    info.man = [info.man];
  }

  // if the keywords field is a string then split it on any whitespace
  if (typeof info.keywords === 'string') {
    info.keywords = info.keywords.split(/\s+/g);
  }

  // if there's no contributors field but an authors field then expand it
  if (!info.contributors && files.indexOf('AUTHORS') >= 0) {
    let authors = await fs.readFile(path.join(moduleLoc, 'AUTHORS'));
    authors = authors.split(/\r?\n/g) // split on lines
      .map((line): string => line.replace(/^\s*#.*$/, '').trim()) // remove comments
      .filter((line): boolean => !!line); // remove empty lines
    info.contributors = authors;
  }

  // expand people fields to objects
  if (typeof info.author === 'string' || _.isPlainObject(info.author)) {
    info.author = normalisePerson(info.author);
  }
  if (Array.isArray(info.contributors)) {
    info.contributors = info.contributors.map(normalisePerson);
  }
  if (Array.isArray(info.maintainers)) {
    info.maintainers = info.maintainers.map(normalisePerson);
  }

  // if there's no readme field then load the README file from the cwd
  if (!info.readme) {
    const readmeFilename = _.find(files, (filename): boolean => {
      const lower = filename.toLowerCase();
      return lower === 'readme' || lower.indexOf('readme.') === 0;
    });

    if (readmeFilename) {
      info.readmeFilename = readmeFilename;
      info.readme = await fs.readFile(path.join(moduleLoc, readmeFilename));
    }
  }

  // if there's no description then take the first paragraph from the readme
  if (!info.description && info.readme) {
    const desc = extractDescription(info.readme);
    if (desc) {
      info.description = desc;
    }
  }

  // if the repository field is a string then assume it's a git repo and expand it
  if (typeof info.repository === 'string') {
    info.repository = {
      type: 'git',
      url: info.repository,
    };
  }

  // explode info.repository.url if it's a hosted git shorthand
  if (typeof info.repository === 'object' && typeof info.repository.url === 'string') {
    info.repository.url = hostedGitFragmentToGitUrl(info.repository.url);
  }

  // allow bugs to be specified as a string, expand it to an object with a single url prop
  if (typeof info.bugs === 'string') {
    info.bugs = {url: info.bugs};
  }

  // normalise homepage url to http
  if (typeof info.homepage === 'string') {
    const parts = url.parse(info.homepage);
    parts.protocol = parts.protocol || 'http:';
    if (parts.pathname && !parts.hostname) {
      parts.hostname = parts.pathname;
      parts.pathname = '';
    }
    // $FlowFixMe: https://github.com/facebook/flow/issues/908
    info.homepage = url.format(parts);
  }

  // if the `bin` field is as string then expand it to an object with a single property
  // based on the original `bin` field and `name field`
  // { name: "foo", bin: "cli.js" } -> { name: "foo", bin: { foo: "cli.js" } }
  if (typeof info.bin === 'string') {
    info.bin = {[info.name]: info.bin};
  }

  // bundleDependencies is an alias for bundledDependencies
  if (info.bundledDependencies) {
    info.bundleDependencies = info.bundledDependencies;
    delete info.bundledDependencies;
  }

  // dummy script object to shove file inferred scripts onto
  const scripts = info.scripts || {};

  // if there's a server.js file and no start script then set it to `node server.js`
  if (!scripts.start && files.indexOf('server.js') >= 0) {
    scripts.start = 'node server.js';
  }

  // if there's a binding.gyp file and no install script then set it to `node-gyp rebuild`
  if (!scripts.install && files.indexOf('binding.gyp') >= 0) {
    scripts.install = 'node-gyp rebuild';
  }

  // set scripts if we've polluted the empty object
  if (!_.isEmpty(scripts)) {
    info.scripts = scripts;
  }

  // explode directories
  const dirs = info.directories;
  if (dirs) {
    if (!info.bin && dirs.bin) {
      const bin = info.bin = {};

      for (const scriptName of await fs.readdir(path.join(moduleLoc, dirs.bin))) {
        if (scriptName[0] === '.') {
          continue;
        }
        bin[scriptName] = path.join('.', dirs.bin, scriptName);
      }
    }

    if (!info.man && dirs.man) {
      const man = info.man = [];

      for (const filename of await fs.readdir(path.join(moduleLoc, dirs.man))) {
        if (/^(.*?)\.[0-9]$/.test(filename)) {
          man.push(path.join('.', dirs.man, filename));
        }
      }
    }

    delete info.directories;
  }

  // infer license file
  // TODO: show that this were inferred and may not be accurate
  const licenseFile = _.find(files, (filename): boolean => {
    const lower = filename.toLowerCase();
    return lower === 'license' || lower.indexOf('license.') === 0;
  });

  if (licenseFile) {
    const licenseContent = await fs.readFile(path.join(moduleLoc, licenseFile));
    info.licenseText = licenseContent;

    if (!info.license) {
      info.license = inferLicense(licenseContent) || inferLicense(info.readme);
    }
  }
}
