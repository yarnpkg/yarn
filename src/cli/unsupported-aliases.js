/* @flow */

const shorthands: {[key: string]: string} = {
  c: 'config',
  i: 'install',
  la: 'list',
  ll: 'list',
  ln: 'link',
  ls: 'list',
  r: 'remove',
  rb: 'rebuild',
  rm: 'remove',
  t: 'test',
  tst: 'test',
  un: 'remove',
  up: 'upgrade',
  v: 'version',
};

const affordances: {[key: string]: string} = {
  'add-user': 'login',
  adduser: 'login',
  author: 'owner',
  'dist-tag': 'tag',
  'dist-tags': 'tag',
  isntall: 'install',
  'run-script': 'run',
  runScript: 'run',
  show: 'info',
  uninstall: 'remove',
  update: 'upgrade',
  verison: 'version',
  view: 'info',
};

export default ({
  ...shorthands,
  ...affordances,
}: {[key: string]: string});
