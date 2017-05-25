import Path from 'path';

export function validate(path) {

    if (Path === Path.posix && isAbsolute(path) && !normalize(path).startsWith(`/`))
        throw new Error(`This system doesn't support drive letters`);

    return true;

}

export function dirname(path) {

    return normalize(Path.win32.dirname(path));

}

export function normalize(path) {

    // We don't want the "./" prefix, because it makes it harder to apply pattern matching

    return Path.win32.normalize(path).replace(/\\/g, `/`).replace(/\/$/, ``).replace(/^\.\//g, ``);

}

export function isAbsolute(path) {

    return Path.win32.isAbsolute(path);

}

export function isRelative(path) {

    return !isAbsolute(path);

}

export function isForward(path) {

    return isRelative(path) && !normalize(path).startsWith(`../`);

}

export function resolve(... paths) {

    return normalize(Path.win32.resolve(... paths));

}

export function relative(fromPath, toPath) {

    return normalize(Path.win32.relative(fromPath, toPath));

}

export function makeExplicit(path) {

    return normalize(path).replace(/^(?!\.{0,2}\/|\.$)/, `./`);

}

export function isPathForSure(maybePath) {

    return isAbsolute(maybePath) || normalize(maybePath).match(/^\.{1,2}\//);

}
