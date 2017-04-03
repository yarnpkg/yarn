import { readFileSync } from 'fs';
import rc from 'rc';

import parse from './lockfile/parse.js';

// Keys that will be propagated into the command line as arguments
const ARG_KEYS = [
    'production',

    'offline',
    'prefer-offline',
    'proxy',
    'https-proxy',
    'network-concurrency',
    'har',

    'strict-semver',
    'ignore-engines',
    'ignore-optional',
    'ignore-platform',
    'ignore-scripts',
    'skip-integrity-check',

    'no-lockfile',
    'pure-lockfile',
    'frozen-lockfile',

    'no-bin-links',
    'link-duplicates',
    'flat',

    'cache-folder',
    'modules-folder',
    'global-folder',

    'mutex',

    'cli.no-emoji',
    'cli.verbose',

    'unsafe.force',
];

// Keys that will get resolved relative to the path of the rc file they belong to
const PATH_KEYS = [
    'cache-folder',
    'global-folder',
    'modules-folder',
];

// Map old keys to more recent ones
const ALIAS_KEYS = {
    //'yarn-offline-mirror': 'mirror-path'
    //'skip-integrity-check': 'ignore-integrity'
};

const buildRcConf = () => rc('yarn', {}, [], fileText => {
    const values = parse(fileText, null);

    for (let key of Object.keys(ALIAS_KEYS)) {
        if (Object.prototype.hasOwnProperty.call(values, key)) {
            values[ALIAS_KEYS[key]] = values[key];
        }
    }

    for (let key of PATH_KEYS) {
        if (Object.prototype.hasOwnProperty.call(values, key)) {
            values[key] = resolve(dirname(filePath), values[key]);
        }
    }

    return values;
});

export function getRcConf() {
    if (!getRcConf.cache)
        getRcConf.cache = buildRcConf();

    return getRcConf.cache;
}

const buildRcArgs = () => ARG_KEYS.reduce((args, key) => {
    const value = getRcConf()[key];

    // some arg keys (such as unsafe.force) are namespaced in the yarnrc
    const arg = key.replace(/^[^.]\./, ``);

    if (typeof value === 'string') {
        args = args.concat([ `--${arg}`, value ]);
    } else if (typeof value === 'boolean') {
        args = args.concat([ `--${arg}` ]);
    }

    return args;
}, []);

export function getRcArgs() {
    if (!getRcArgs.cache)
        getRcArgs.cache = buildRcArgs();

    return getRcArgs.cache;
}

export function clearRcCache() {
    getRcConf.cache = null;
    getRcArgs.cache = null;
}
