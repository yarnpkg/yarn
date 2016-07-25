'use strict';

/**
 * This script bumps a new version for open source releases.
 * It updates the version in podspec/json/gradle files and makes sure they are consistent between each other
 * After changing the files it makes a commit and tags it.
 * All you have to do is push changes to remote and CI will make a new build.
 */
/*eslint-disable no-undef */
require(`shelljs/global`);

let files = ls('common-mirror');
cd('common-mirror');

for(let file of files) {
  echo('parsing', file)
  exec(`tar -xvzf ${file}`, {silent: true});
  let folder = ls('').filter(name => name.indexOf('.tgz') === -1 && name !== 'new')[0];
  mkdir('new');
  cp(`${folder}/package.json`, 'new/package.json');
  cd('new');
  let packageJson = JSON.parse(cat('package.json'));
  if (packageJson.scripts || packageJson.bin) {
    delete packageJson.scripts;
    delete packageJson.bin;
    JSON.stringify(packageJson, null, 4).to('package.json');
    exec('npm pack');
    mv(file, '..');
  }
  cd('..');
  rm('-rf', [folder, 'new'])
}
