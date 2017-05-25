import runPager        from 'default-pager';
import { PassThrough } from 'stream';

export function pager(stream) {

    return new Promise((resolve, reject) => {

        if (stream instanceof Buffer)
            stream = stream.toString(`utf8`);

        if (typeof stream === `string`) {

            if (process.stdout.isTTY && ((stream.match(/(\r\n|\r|\n)/g) || []).length >= process.stdout.rows || stream.match(new RegExp(`.{${process.stdout.columns},}`)))) {
                runPager(resolve).end(stream);
            } else {
                process.stdout.write(stream);
                resolve();
            }

        } else {

            stream.pipe(runPager(resolve));

        }

    });

}

export function readStream(stream, { resume = true } = {}) {

    if (typeof stream === `string`)
        stream = new Buffer(stream);

    if (stream instanceof Buffer)
        return Promise.resolve(stream);

    stream.resume();

    return new Promise((resolve, reject) => {

        let chunks = [];

        stream.on(`data`, chunk => {
            chunks.push(chunk);
        });

        stream.on(`error`, error => {
            reject(error);
        });

        stream.on(`end`, () => {
            resolve(Buffer.concat(chunks));
        });

    });

}
