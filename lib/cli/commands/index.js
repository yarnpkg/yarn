'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _constants;

function _load_constants() {
  return _constants = _interopRequireWildcard(require('../../constants.js'));
}

var _access;

function _load_access() {
  return _access = _interopRequireWildcard(require('./access.js'));
}

var _add;

function _load_add() {
  return _add = _interopRequireWildcard(require('./add.js'));
}

var _audit;

function _load_audit() {
  return _audit = _interopRequireWildcard(require('./audit.js'));
}

var _autoclean;

function _load_autoclean() {
  return _autoclean = _interopRequireWildcard(require('./autoclean.js'));
}

var _bin;

function _load_bin() {
  return _bin = _interopRequireWildcard(require('./bin.js'));
}

var _cache;

function _load_cache() {
  return _cache = _interopRequireWildcard(require('./cache.js'));
}

var _check;

function _load_check() {
  return _check = _interopRequireWildcard(require('./check.js'));
}

var _config;

function _load_config() {
  return _config = _interopRequireWildcard(require('./config.js'));
}

var _create;

function _load_create() {
  return _create = _interopRequireWildcard(require('./create.js'));
}

var _exec;

function _load_exec() {
  return _exec = _interopRequireWildcard(require('./exec.js'));
}

var _generateLockEntry;

function _load_generateLockEntry() {
  return _generateLockEntry = _interopRequireWildcard(require('./generate-lock-entry.js'));
}

var _global;

function _load_global() {
  return _global = _interopRequireWildcard(require('./global.js'));
}

var _help;

function _load_help() {
  return _help = _interopRequireWildcard(require('./help.js'));
}

var _import;

function _load_import() {
  return _import = _interopRequireWildcard(require('./import.js'));
}

var _info;

function _load_info() {
  return _info = _interopRequireWildcard(require('./info.js'));
}

var _init;

function _load_init() {
  return _init = _interopRequireWildcard(require('./init.js'));
}

var _install;

function _load_install() {
  return _install = _interopRequireWildcard(require('./install.js'));
}

var _licenses;

function _load_licenses() {
  return _licenses = _interopRequireWildcard(require('./licenses.js'));
}

var _link;

function _load_link() {
  return _link = _interopRequireWildcard(require('./link.js'));
}

var _login;

function _load_login() {
  return _login = _interopRequireWildcard(require('./login.js'));
}

var _logout;

function _load_logout() {
  return _logout = _interopRequireWildcard(require('./logout.js'));
}

var _list;

function _load_list() {
  return _list = _interopRequireWildcard(require('./list.js'));
}

var _node;

function _load_node() {
  return _node = _interopRequireWildcard(require('./node.js'));
}

var _outdated;

function _load_outdated() {
  return _outdated = _interopRequireWildcard(require('./outdated.js'));
}

var _owner;

function _load_owner() {
  return _owner = _interopRequireWildcard(require('./owner.js'));
}

var _pack;

function _load_pack() {
  return _pack = _interopRequireWildcard(require('./pack.js'));
}

var _policies;

function _load_policies() {
  return _policies = _interopRequireWildcard(require('./policies.js'));
}

var _publish;

function _load_publish() {
  return _publish = _interopRequireWildcard(require('./publish.js'));
}

var _remove;

function _load_remove() {
  return _remove = _interopRequireWildcard(require('./remove.js'));
}

var _run;

function _load_run() {
  return _run = _interopRequireWildcard(require('./run.js'));
}

var _tag;

function _load_tag() {
  return _tag = _interopRequireWildcard(require('./tag.js'));
}

var _team;

function _load_team() {
  return _team = _interopRequireWildcard(require('./team.js'));
}

var _unplug;

function _load_unplug() {
  return _unplug = _interopRequireWildcard(require('./unplug.js'));
}

var _unlink;

function _load_unlink() {
  return _unlink = _interopRequireWildcard(require('./unlink.js'));
}

var _upgrade;

function _load_upgrade() {
  return _upgrade = _interopRequireWildcard(require('./upgrade.js'));
}

var _version;

function _load_version() {
  return _version = _interopRequireWildcard(require('./version.js'));
}

var _versions;

function _load_versions() {
  return _versions = _interopRequireWildcard(require('./versions.js'));
}

var _why;

function _load_why() {
  return _why = _interopRequireWildcard(require('./why.js'));
}

var _workspaces;

function _load_workspaces() {
  return _workspaces = _interopRequireWildcard(require('./workspaces.js'));
}

var _workspace;

function _load_workspace() {
  return _workspace = _interopRequireWildcard(require('./workspace.js'));
}

var _upgradeInteractive;

function _load_upgradeInteractive() {
  return _upgradeInteractive = _interopRequireWildcard(require('./upgrade-interactive.js'));
}

var _useless;

function _load_useless() {
  return _useless = _interopRequireDefault(require('./_useless.js'));
}

var _aliases;

function _load_aliases() {
  return _aliases = _interopRequireDefault(require('../aliases.js'));
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

const chalk = require('chalk');


const getDocsLink = name => `${(_constants || _load_constants()).YARN_DOCS}${name || ''}`;
const getDocsInfo = name => 'Visit ' + chalk.bold(getDocsLink(name)) + ' for documentation about this command.';

const commands = {
  access: _access || _load_access(),
  add: _add || _load_add(),
  audit: _audit || _load_audit(),
  autoclean: _autoclean || _load_autoclean(),
  bin: _bin || _load_bin(),
  cache: _cache || _load_cache(),
  check: _check || _load_check(),
  config: _config || _load_config(),
  create: _create || _load_create(),
  dedupe: (0, (_useless || _load_useless()).default)("The dedupe command isn't necessary. `yarn install` will already dedupe."),
  exec: _exec || _load_exec(),
  generateLockEntry: _generateLockEntry || _load_generateLockEntry(),
  global: _global || _load_global(),
  help: _help || _load_help(),
  import: _import || _load_import(),
  info: _info || _load_info(),
  init: _init || _load_init(),
  install: _install || _load_install(),
  licenses: _licenses || _load_licenses(),
  link: _link || _load_link(),
  lockfile: (0, (_useless || _load_useless()).default)("The lockfile command isn't necessary. `yarn install` will produce a lockfile."),
  login: _login || _load_login(),
  logout: _logout || _load_logout(),
  list: _list || _load_list(),
  node: _node || _load_node(),
  outdated: _outdated || _load_outdated(),
  owner: _owner || _load_owner(),
  pack: _pack || _load_pack(),
  policies: _policies || _load_policies(),
  prune: (0, (_useless || _load_useless()).default)("The prune command isn't necessary. `yarn install` will prune extraneous packages."),
  publish: _publish || _load_publish(),
  remove: _remove || _load_remove(),
  run: _run || _load_run(),
  tag: _tag || _load_tag(),
  team: _team || _load_team(),
  unplug: _unplug || _load_unplug(),
  unlink: _unlink || _load_unlink(),
  upgrade: _upgrade || _load_upgrade(),
  version: _version || _load_version(),
  versions: _versions || _load_versions(),
  why: _why || _load_why(),
  workspaces: _workspaces || _load_workspaces(),
  workspace: _workspace || _load_workspace(),
  upgradeInteractive: _upgradeInteractive || _load_upgradeInteractive()
};

for (const key in commands) {
  commands[key].getDocsInfo = getDocsInfo(key);
}

for (const key in (_aliases || _load_aliases()).default) {
  commands[key] = commands[(_aliases || _load_aliases()).default[key]];
  commands[key].getDocsInfo = getDocsInfo(key);
}

exports.default = commands;