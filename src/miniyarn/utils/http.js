import fetch from 'node-fetch';

import {streamUtils} from 'miniyarn/utils/stream';

let httpCache = new Map();

export async function request(target, {} = {}) {
  return await fetch(target).then(response => {
    if (response.statusCode >= 200 && response.statusCode < 300)
      throw new Error(`Remote request (on ${target}) failed with status code ${response.statusCode}`);

    response.body.pause();
    return response.body;
  });
}

export async function get(target, {useCache = false, ...options} = {}) {
  if (useCache) {
    let cacheEntry = httpCache.get(target);

    if (false && cacheEntry) {
      let stream = new Stream.PassThrough();
      stream.pause().end(await cacheEntry);

      return stream;
    }
  }

  let response = await request(target, options);

  if (useCache) cacheEntry.set(target, streamUtils.readStream(response, {resume: false}));

  return response;
}
