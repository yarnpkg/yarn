/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {registryNames} from '../../registries/index.js';
import Lockfile from '../../lockfile/wrapper.js';
import {Install} from './install.js';
import * as child from '../../util/child.js';
import * as fs from '../../util/fs.js';

const objectPath = require('object-path');
const path = require('path');

export const noArguments = true;

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
  let author;
  if (await fs.exists(path.join(config.cwd, '.git'))) {
    // get git origin of the cwd
    gitUrl = await child.spawn('git', ['config', 'remote.origin.url'], {cwd: config.cwd});

    // get author default based on git config
    const name = await child.spawn('git', ['config', 'user.name']);
    const email = await child.spawn('git', ['config', 'user.email']);
    author = `${name} (${email})`;
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
      default: '1.0.0',
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
      default: author,
    },
    {
      key: 'license',
      question: 'license',
      default: 'MIT',
    },
  ];

  // get answers
  const pkg = {};
  for (let {key: manifestKey, question, default: def} of keys) {
    for (let registryName of registryNames) {
      const {json} = manifests[registryName];
      const val = objectPath.get(json, manifestKey);
      if (val) {
        def = val;
        break;
      }
    }

    if (def) {
      question += ` (${def})`;
    }

    const answer = (await reporter.question(question)) || def;
    if (answer) {
      objectPath.set(pkg, manifestKey, answer);
    }
  }

  // if we have a git url then set the type
  if (pkg.repository.url) {
    pkg.repository.type = 'git';
  }

  // save answers
  let targetManifests = [];
  for (let registryName of registryNames) {
    let info = manifests[registryName];
    if (info.exists) {
      targetManifests.push(info);
    }
  }
  if (!targetManifests.length) {
    targetManifests.push(manifests.npm);
  }
  for (let targetManifest of targetManifests) {
    Object.assign(targetManifest.json, pkg);
    reporter.success(`Saved ${path.basename(targetManifest.loc)}`);
  }

  await install.saveRootManifests(manifests);
}
