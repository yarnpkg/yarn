/* @flow */
/* eslint max-len: 0 */

import execa from 'execa';
import {sh} from 'puka';
import makeTemp from './_temp.js';
import * as fs from '../src/util/fs.js';

const path = require('path');

function runYarnStreaming(args: Array<string> = [], options: Object = {}): execa.ExecaChildPromise {
  if (!options['env']) {
    options['env'] = {...process.env};
    options['extendEnv'] = false;
  }
  options['env']['FORCE_COLOR'] = 0;

  return execa.shell(sh`${path.resolve(__dirname, '../bin/yarn')} ${args}`, options);
}

test('terminate console stream quietly on EPIPE', async () => {
  const cwd = await makeTemp();
  const packageJsonPath = path.join(cwd, 'package.json');
  const initialManifestFile = JSON.stringify({name: 'test', license: 'ISC', version: '1.0.0'});

  await fs.writeFile(packageJsonPath, initialManifestFile);

  const {stdout, stderr} = runYarnStreaming(['versions'], {cwd});

  stdout.destroy();

  await new Promise((resolve, reject) => {
    let stderrOutput = '';
    stderr.on('readable', () => {
      const chunk = stderr.read();
      if (chunk) {
        stderrOutput += chunk;
      } else {
        resolve(stderrOutput);
      }
    });
    stderr.on('error', err => {
      reject(err);
    });
  })
    .then(stderrOutput => {
      expect(stderrOutput).not.toMatch(/EPIPE/);
    })
    .catch(err => {
      expect(err).toBeFalsy();
    });
});

test('terminate console stream preserving zero exit code on EPIPE', async () => {
  const cwd = await makeTemp();
  const packageJsonPath = path.join(cwd, 'package.json');
  const initialManifestFile = JSON.stringify({name: 'test', license: 'ISC', version: '1.0.0'});

  await fs.writeFile(packageJsonPath, initialManifestFile);

  const proc = runYarnStreaming(['versions'], {cwd});

  const {stdout} = proc;

  stdout.destroy();

  await new Promise(resolve => {
    proc.on('exit', function(code, signal) {
      resolve(code);
    });
  }).then(exitCode => {
    expect(exitCode).toEqual(0);
  });
});

test('terminate console stream preserving non-zero exit code on EPIPE', async () => {
  const cwd = await makeTemp();
  const packageJsonPath = path.join(cwd, 'package.json');
  const initialManifestFile = JSON.stringify({name: 'test', license: 'ISC', version: '1.0.0'});

  await fs.writeFile(packageJsonPath, initialManifestFile);

  const proc = runYarnStreaming(['add'], {cwd});

  const {stdout} = proc;

  stdout.destroy();

  await new Promise(resolve => {
    proc.on('exit', function(code, signal) {
      resolve(code);
    });
  }).then(exitCode => {
    expect(exitCode).toEqual(1);
  });
});
