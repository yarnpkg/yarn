/* @flow */

import type {Reporter} from '../../reporters/index.js';
import {isValidLicense} from './util.js';
import {normalisePerson, extractDescription} from './util.js';
import {hostedGitFragmentToGitUrl} from '../../resolvers/index.js';
import inferLicense from './infer-license.js';
import * as fs from '../fs.js';

const semver = require('semver');
const path = require('path');
const url = require('url');

const LICENSE_RENAMES = {
  'MIT/X11': 'MIT',
  X11: 'MIT',
};

type Dict<T> = {
  [key: string]: T;
};

class ManifestError extends Error {
  key: string;
  problem: string;

  constructor(key: string, problem: string) {
    super();
    this.key = key;
    this.problem = problem;
  }

  get message(): string {
    return `Fatal problem with ${this.key} in manifest: ${this.problem}`;
  }
}

export default async function (
  info: Dict<mixed>,
  moduleLoc: string,
  reporter: Reporter,
  looseSemver: boolean,
): Promise<void> {
  const files = await fs.readdir(moduleLoc);

  // clean info.version
  if (typeof info.version === 'string' && !semver.valid(info.version)) {
    info.version = semver.clean(info.version, looseSemver) || info.version;
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
  if (typeof info.author === 'string' || typeof info.author === 'object') {
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
    const readmeFilename = files.find((filename): boolean => {
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

  let repo = info.repository;

  // explode info.repository.url if it's a hosted git shorthand
  if (repo && typeof repo === 'object' && typeof repo.url === 'string') {
    repo.url = hostedGitFragmentToGitUrl(repo.url, reporter);
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

  const name = info.name;

  if (typeof name !== 'string') {
    throw new ManifestError('name', 'must be a string');
  }

  // if the `bin` field is as string then expand it to an object with a single property
  // based on the original `bin` field and `name field`
  // { name: "foo", bin: "cli.js" } -> { name: "foo", bin: { foo: "cli.js" } }
  if (typeof info.bin === 'string') {
    info.bin = {[name]: info.bin};
  }

  // bundleDependencies is an alias for bundledDependencies
  if (info.bundledDependencies) {
    info.bundleDependencies = info.bundledDependencies;
    delete info.bundledDependencies;
  }

  let scripts: Object;

  // dummy script object to shove file inferred scripts onto
  if (info.scripts && typeof info.scripts === 'object') {
    scripts = info.scripts;
  } else {
    scripts = {};
  }

  // if there's a server.js file and no start script then set it to `node server.js`
  if (!scripts.start && files.indexOf('server.js') >= 0) {
    scripts.start = 'node server.js';
  }

  // if there's a binding.gyp file and no install script then set it to `node-gyp rebuild`
  if (!scripts.install && files.indexOf('binding.gyp') >= 0) {
    scripts.install = 'node-gyp rebuild';
  }

  // set scripts if we've polluted the empty object
  if (Object.keys(scripts).length) {
    info.scripts = scripts;
  }

  let dirs = info.directories;

  if (dirs && typeof dirs === 'object') {
    const binDir = dirs.bin;

    if (!info.bin && binDir && typeof binDir === 'string') {
      const bin = info.bin = {};

      for (const scriptName of await fs.readdir(path.join(moduleLoc, binDir))) {
        if (scriptName[0] === '.') {
          continue;
        }
        bin[scriptName] = path.join('.', binDir, scriptName);
      }
    }

    const manDir = dirs.man;

    if  (!info.man && typeof manDir === 'string') {
      const man = info.man = [];

      for (const filename of await fs.readdir(path.join(moduleLoc, manDir))) {
        if (/^(.*?)\.[0-9]$/.test(filename)) {
          man.push(path.join('.', manDir, filename));
        }
      }
    }
  }

  delete info.directories;

  // normalise licenses field
  let licenses = info.licenses;
  if (Array.isArray(licenses) && !info.license) {
    let licenseTypes = [];

    for (let license of licenses) {
      if (license && typeof license === 'object') {
        license = license.type;
      }
      if (typeof license === 'string') {
        licenseTypes.push(license);
      }
    }

    licenseTypes = licenseTypes.filter(isValidLicense);

    if (licenseTypes.length === 1) {
      info.license = licenseTypes[0];
    } else if (licenseTypes.length) {
      info.license = `(${licenseTypes.join(' OR ')})`;
    }
  }

  let license = info.license;

  // normalise license
  if (license && typeof license === 'object') {
    info.license = license.type;
  }

  // get license file
  const licenseFile = files.find((filename): boolean => {
    const lower = filename.toLowerCase();
    return lower === 'license' || lower.indexOf('license.') === 0;
  });
  if (licenseFile) {
    const licenseContent = await fs.readFile(path.join(moduleLoc, licenseFile));
    const inferredLicense = inferLicense(licenseContent);
    info.licenseText = licenseContent;

    const license = info.license;

    if (typeof license === 'string') {
      if (inferredLicense && isValidLicense(inferredLicense) && !isValidLicense(license)) {
        // some packages don't specify their license version but we can infer it based on their license file
        const basicLicense = license.toLowerCase().replace(/(-like|\*)$/g, '');
        const expandedLicense = inferredLicense.toLowerCase();
        if (expandedLicense.startsWith(basicLicense)) {
          // TODO consider doing something to notify the user
          info.license = inferredLicense;
        }
      }
    } else if (inferredLicense) {
      // if there's no license then infer it based on the license file
      info.license = inferredLicense;
    } else {
        // valid expression to refer to a license in a file
      info.license = `SEE LICENSE IN ${licenseFile}`;
    }
  }

  if (typeof info.license === 'string') {
    // sometimes licenses are known by different names, reduce them
    info.license = LICENSE_RENAMES[info.license] || info.license;
  } else if (typeof info.readme === 'string') {
    // the license might be at the bottom of the README
    const inferredLicense = inferLicense(info.readme);
    if (inferredLicense) {
      info.license = inferredLicense;
    }
  }
}
