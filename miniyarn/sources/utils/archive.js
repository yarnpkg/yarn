import makeDeferred     from 'deferred';
import EventEmitter     from 'eventemitter3';
import gunzipMaybe      from 'gunzip-maybe';
import { PassThrough }  from 'stream';
import tar              from 'tar-stream';

import * as miscUtils   from 'miniyarn/utils/misc';
import * as pathUtils   from 'miniyarn/utils/path';
import * as streamUtils from 'miniyarn/utils/stream';

export function createTarballWriter() {

    let packer = tar.pack();
    let entryQueue = Promise.resolve();

    return {

        promise: new Promise((resolve, reject) => {

            packer.on(`error`, error => {
                reject(error);
            });

            packer.on(`close`, () => {
                resolve();
            });

        }),

        entry(header, source) {

            entryQueue = Promise.all([ streamUtils.readStream(source), entryQueue ]).then(([ body ]) => {
                packer.entry(header, body);
            });

        },

        finalize() {

            entryQueue.then(() => {
                packer.finalize();
            });

        },

        pipe(destination, options) {

            packer.pipe(destination, options);

        }

    };

}

export function createFileExtractor(path) {

    let deferred = makeDeferred();

    return {

        promise: deferred.promise,

        entry(header, entry) {

            if (header.name !== path)
                return Promise.resolve();

            streamUtils.readStream(entry).then(body => {
                deferred.resolve(body);
            }, error => {
                deferred.reject(error);
            });

        },

        finalize() {

            deferred.reject(new Error(`File not found (${path})`));

        }

    };

}

export function createArchiveUnpacker({ virtualPath = null } = {}) {

    if (virtualPath) {
        if (!pathUtils.isAbsolute(virtualPath)) {
            throw new Error(`The virtual path has to be an absolute path`);
        } else {
            virtualPath = pathUtils.resolve(virtualPath);
        }
    }

    let stream = new PassThrough();

    let ungzipper = gunzipMaybe();
    stream.pipe(ungzipper);

    let unpacker = tar.extract();
    ungzipper.pipe(unpacker);

    let emitter = new EventEmitter();

    unpacker.on(`entry`, (header, entry, next) => {

        let path = pathUtils.resolve(`/`, header.name);
        let { mode, type } = header;

        if (virtualPath) {

            let relative = pathUtils.relative(virtualPath, path);

            if (!pathUtils.isForward(relative))
                return;

            path = pathUtils.resolve(`/`, relative);

        }

        if (path === `/`)
            return;

        emitter.emit(`entry`, {
            name: pathUtils.relative(`/`, path),
            mode, type,
        }, entry);

        entry.on(`end`, () => {
            next();
        });

        entry.resume();

    });

    unpacker.on(`finish`, () => {

        emitter.emit(`finish`);

    });

    return Object.assign(stream, {

        promise: new Promise((resolve, reject) => {

            ungzipper.on(`error`, error => {
                reject(error);
            });

            unpacker.on(`error`, error => {
                reject(error);
            });

            unpacker.on(`finish`, () => {
                resolve();
            });

        }),

        pipe: function (destination, { end = true, filter = [] } = {}) {

            emitter.on(`entry`, (header, entry) => {

                if (!miscUtils.filePatternMatch(header.name, filter))
                    return;

                destination.entry(header, entry);

            });

            emitter.on(`finish`, () => {

                if (!end)
                    return;

                destination.finalize();

            });

        }

    });

}
