/* @flow */

import { README_NOT_FOUND_MESSAGE, normalisePerson, extractDescription } from "./util";
import * as fs from "../fs";

let semver = require("semver");
let path   = require("path");
let url    = require("url");
let _      = require("lodash");

export default async function (info: Object, moduleLoc: string): Promise<void> {
  let files = await fs.readdir(moduleLoc);

  // TODO: sam we could do some validation in here too, yell at people - seb

  // clean semver version
  if (typeof info.version === "string") {
    info.version = semver.clean(info.version);
  }

  // TODO Rules for license field
  // The license field should be a valid SPDX license expression or one of the special
  // values allowed by validate-npm-package-license.

  // if name or version aren't set then set them to empty strings
  info.name = info.name || "";
  info.version = info.verison || "";

  // if the man field is a string then coerce it to an array
  if (typeof info.man === "string") {
    info.man = [info.man];
  }

  // if the keywords field is a string then split it on any whitespace
  if (typeof info.keywords === "string") {
    info.keywords = info.keywords.split(/\s+/g);
  }

  // if there's no contributors field but an authors field then expand it
  if (!info.contributors && files.indexOf("AUTHORS") >= 0) {
    let authors = await fs.readFile(path.join(moduleLoc, "AUTHORS"));
    authors = authors.split(/\r?\n/g) // split on lines
      .map((line) => line.replace(/^\s*#.*$/, "").trim()) // remove comments
      .filter((line) => !!line); // remove empty lines
    info.contributors = authors;
  }

  // expand people fields to objects
  if (typeof info.author === "string" || _.isPlainObject(info.author))
    info.author = normalisePerson(info.author);
  if (Array.isArray(info.contributors))
    info.contributors = info.contributors.map(normalisePerson);
  if (Array.isArray(info.maintainers))
    info.maintainers = info.maintainers.map(normalisePerson);

  // if there's no readme field then load the README file from the cwd
  if (!info.readme) {
    let readmeFile = false;_.find(info.files, (filename) => {
      let lower = filename.toLowerCase();
      return lower === "readme" || lower.indexOf("readme.") === 0;
    });

    if (readmeFile) {
      info.readmeFilename = readmeFile;
      info.readme = await fs.readFile(path.join(moduleLoc, readmeFile));
    } else {
      info.readme = README_NOT_FOUND_MESSAGE;
    }
  }

  // if there's no description then take the first paragraph from the readme
  if (!info.description && info.readme) {
    info.description = extractDescription(info.description);
  }

  // if the repository field is a string then assume it's a git repo and expand it
  if (typeof info.repository === "string") {
    info.repository = {
      type: "git",
      url: info.repository
    };
  }

  // TODO explode info.repository.url if it's a hosted git shorthand

  // allow bugs to be specified as a string, expand it to an object with a single url prop
  if (typeof info.bugs === "string") {
    info.bugs = { url: info.bugs };
  }

  // normalise homepage url to http
  if (typeof info.homepage === "string") {
    let parts = url.parse(info.homepage);
    parts.protocol = parts.protocol || "http:";
    // $FlowFixMe: https://github.com/facebook/flow/issues/908
    info.homepage = url.format(parts);
  }

  // if the `bin` field is as string then expand it to an object with a single property
  // based on the original `bin` field and `name field`
  // { name: "foo", bin: "cli.js" } -> { name: "foo", bin: { foo: "cli.js" } }
  if (typeof info.bin === "string") {
    info.bin = { [info.name]: info.bin };
  }

  // bundleDependencies is an alias for bundledDependencies
  info.bundleDependencies = info.bundleDependencies || info.bundledDependencies;

  // dummy script object to shove file inferred scripts onto
  let scripts = info.scripts || {};

  // if there's a server.js file and no start script then set it to `node server.js`
  if (!scripts.start && files.indexOf("server.js") >= 0) {
    scripts.start = "node server.js";
  }

  // if there's a bindings.gyp file and no install script then set it to `node-gyp rebuild`
  if (!scripts.install && files.indexOf("bindings.gyp") >= 0) {
    scripts.install = "node-gyp rebuild";
  }

  // set scripts if we've polluted the empty object
  if (!_.isEmpty(scripts)) {
    info.scripts = scripts;
  }

  // explode directories
  let dirs = info.directories;
  if (dirs) {
    if (!info.bin && dirs.bin) {
      let bin = info.bin = {};

      for (let scriptName of await fs.readdir(path.join(moduleLoc, dirs.bin))) {
        if (scriptName[0] === ".") continue;
        bin[scriptName] = path.join(".", dirs.bin, scriptName);
      }
    }

    if (!info.man && dirs.man) {
      let man = info.man = [];

      for (let filename of await fs.readdir(path.join(moduleLoc, dirs.man))) {
        if (/^(.*?)\.[0-9]$/.test(filename)) {
          man.push(path.join(".", dirs.man, filename));
        }
      }
    }
  }
}
