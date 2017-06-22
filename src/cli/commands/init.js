/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {stringifyPerson, extractRepositoryUrl} from '../../util/normalize-manifest/util.js';
import {registryNames} from '../../registries/index.js';
import * as child from '../../util/child.js';
import * as fs from '../../util/fs.js';
import * as validate from '../../util/normalize-manifest/validate.js';

const objectPath = require('object-path');
const path = require('path');

export function setFlags(commander: Object) {
  commander.option('-y, --yes', 'use default options');
}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  const manifests = await config.getRootManifests();

  let repository = {};
  const author = {
    name: config.getOption('init-author-name'),
    email: config.getOption('init-author-email'),
    url: config.getOption('init-author-url'),
  };
  if (await fs.exists(path.join(config.cwd, '.git'))) {
    // get git origin of the cwd
    try {
      repository = {
        type: 'git',
        url: await child.spawn('git', ['config', 'remote.origin.url'], {
          cwd: config.cwd,
        }),
      };
    } catch (ex) {
      // Ignore - Git repo may not have an origin URL yet (eg. if it only exists locally)
    }

    if (author.name === undefined) {
      author.name = await getGitConfigInfo('user.name');
    }

    if (author.email === undefined) {
      author.email = await getGitConfigInfo('user.email');
    }
  }

  const keys = [
    {
      key: 'name',
      question: 'name',
      default: path.basename(config.cwd),
      validation: validate.isValidPackageName,
      validationError: 'invalidPackageName',
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
      key: 'repository',
      question: 'repository url',
      default: extractRepositoryUrl(repository),
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
      let val = objectPath.get(object, manifestKey);
      if (!val) {
        break;
      }
      if (typeof val === 'object') {
        if (manifestKey === 'author') {
          val = stringifyPerson(val);
        } else if (manifestKey === 'repository') {
          val = extractRepositoryUrl(val);
        }
      }
      def = val;
    }

    if (def) {
      question += ` (${def})`;
    }

    let answer;
    let validAnswer = false;

    if (yes) {
      answer = def;
    } else {
      // loop until a valid answer is provided, if validation is on entry
      if (entry.validation) {
        while (!validAnswer) {
          answer = (await reporter.question(question)) || def;
          // validate answer
          if (entry.validation(String(answer))) {
            validAnswer = true;
          } else {
            reporter.error(reporter.lang('invalidPackageName'));
          }
        }
      } else {
        answer = (await reporter.question(question)) || def;
      }
    }

    if (answer) {
      objectPath.set(pkg, manifestKey, answer);
    }
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

  await config.saveRootManifests(manifests);
}

export async function getGitConfigInfo(credential: string, spawn = child.spawn): Promise<string> {
  try {
    // try to get author default based on git config
    return await spawn('git', ['config', credential]);
  } catch (e) {
    return '';
  }
}
