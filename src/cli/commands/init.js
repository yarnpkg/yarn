/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {stringifyPerson} from '../../util/normalize-manifest/util.js';
import {registryNames} from '../../registries/index.js';
import Lockfile from '../../lockfile/wrapper.js';
import {Install} from './install.js';
import * as child from '../../util/child.js';
import * as fs from '../../util/fs.js';

const objectPath = require('object-path');
const path = require('path');

export function setFlags(commander: Object) {
  commander.option('-y, --yes', 'use default options');
}

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  const lockfile = new Lockfile();
  const install = new Install(flags, config, reporter, lockfile);
  const manifests = await install.getRootManifests();

  let gitUrl;
  const author = {
    name: config.getOption('init-author-name'),
    email: config.getOption('init-author-email'),
    url: config.getOption('init-author-url'),
  };
  if (await fs.exists(path.join(config.cwd, '.git'))) {
    // get git origin of the cwd
    try {
      gitUrl = await child.spawn('git', ['config', 'remote.origin.url'], {cwd: config.cwd});
    } catch (ex) {
      // Ignore - Git repo may not have an origin URL yet (eg. if it only exists locally)
    }

    // get author default based on git config
    author.name = author.name || await child.spawn('git', ['config', 'user.name']);
    author.email = author.email || await child.spawn('git', ['config', 'user.email']);
  }

  const keys = [
    {
      key: 'name',
      question: 'name',
      default: path.basename(config.cwd),
    },
    {
      key: 'version',
      question: 'version',
      default: String(config.getOption('init-version')),
    },
    {
      key: 'description',
      question: 'description',
      default: '',
    },
    {
      key: 'main',
      question: 'entry point',
      default: 'index.js',
    },
    {
      key: 'repository.url',
      question: 'git repository',
      default: gitUrl,
    },
    {
      key: 'author',
      question: 'author',
      default: stringifyPerson(author),
    },
    {
      key: 'license',
      question: 'license',
      default: String(config.getOption('init-license')),
    },
  ];

  // get answers
  const pkg = {};
  for (const entry of keys) {
    const {yes} = flags;
    const {key: manifestKey} = entry;
    let {question, default: def} = entry;

    for (const registryName of registryNames) {
      const {object} = manifests[registryName];
      const val = objectPath.get(object, manifestKey);
      if (val) {
        def = val;
        break;
      }
    }

    if (def) {
      question += ` (${def})`;
    }

    let answer;

    if (yes) {
      answer = def;
    } else {
      answer = (await reporter.question(question)) || def;
    }

    if (answer) {
      objectPath.set(pkg, manifestKey, answer);
    }
  }

  // if we have a git url then set the type
  if (pkg.repository && pkg.repository.url) {
    pkg.repository.type = 'git';
  }

  // save answers
  const targetManifests = [];
  for (const registryName of registryNames) {
    const info = manifests[registryName];
    if (info.exists) {
      targetManifests.push(info);
    }
  }
  if (!targetManifests.length) {
    targetManifests.push(manifests.npm);
  }
  for (const targetManifest of targetManifests) {
    Object.assign(targetManifest.object, pkg);
    reporter.success(`Saved ${path.basename(targetManifest.loc)}`);
  }

  await install.saveRootManifests(manifests);
}
