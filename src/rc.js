import { readFileSync } from 'fs';
import rc from 'rc';

import parse from './lockfile/parse.js';

// Keys that will get resolved relative to the path of the rc file they belong to
const PATH_KEYS = [
    'cache-folder',
    'global-folder',
    'modules-folder',
];

const buildRcConf = () => rc('yarn', {}, [], fileText => {
    const values = parse(fileText, null);
    const keys = Object.keys(values);

    for (let key of keys) {
        for (let pathKey of PATH_KEYS) {
            if (key === pathKey || key.endsWith(`.${pathKey}`)) {
                values[key] = resolve(dirname(filePath), values[key]);
            }
        }
    }

    return values;
});

export function getRcConf() {
    if (!getRcConf.cache)
        getRcConf.cache = buildRcConf();

    return getRcConf.cache;
}

const buildRcArgs = () => Object.keys(getRcConf()).reduce((argLists, key) => {
    if (!key.startsWith(`--`))
        return argLists;

    const [, namespace = `*`, arg] = key.match(/^--(?:([^.]+)\.)?(.*)$/);
    const value = getRcConf()[key];

    if (!argLists[namespace]) {
        argLists[namespace] = [];
    }

    if (typeof value === 'string') {
        argLists[namespace] = argLists[namespace].concat([`--${arg}`, value]);
    } else {
        argLists[namespace] = argLists[namespace].concat([`--${arg}`]);
    }

    console.error(argLists);

    return argLists;
}, {});

export function getRcArgs(command) {
    if (!getRcArgs.cache)
        getRcArgs.cache = buildRcArgs();

    let result = getRcArgs.cache;

    if (typeof command !== 'undefined')
        result = result['*'] || [];

    if (command !== '*')
        result = result.concat(result[command] || []);

    return result;
}

export function clearRcCache() {
    getRcConf.cache = null;
    getRcArgs.cache = null;
}
