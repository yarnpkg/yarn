/* @flow */

import * as constants from "../constants";
import { SecurityError } from "../errors";
import * as crypto from "../util/crypto";
import BaseFetcher from "./_base";

let request = require("request");
let zlib    = require("zlib");
let tar     = require("tar");
let url     = require("url");
let _       = require("lodash");

export default class TarballFetcher extends BaseFetcher {
  async _fetch(dest: string): Promise<string> {
    let { reference: ref, hash } = this;

    if (!hash) {
      let parts = url.parse(ref);
      if (parts.protocol === "http:") {
        throw new SecurityError(`Refusing to fetch tarball ${ref} over plain HTTP without a hash`);
      }
    }

    return new Promise((resolve, reject) => {
      // use _.once as if we're called from an `error` event then we'll get called again
      // from `end`
      let done = _.once(function (err, hash) {
        if (err) {
          err.message = `Error while fetching ${JSON.stringify(ref)}: ${err.message}`;
          reject(err);
        } else {
          resolve(hash);
        }
      });

      let validateStream = crypto.hashStreamValidation();

      let extractor = tar.Extract({ path: dest, strip: 1 })
        .on("error", done)
        .on("end", function () {
          let expectHash = hash;
          let actualHash = validateStream.getHash();
          if (!expectHash || expectHash === actualHash) {
            done(null, actualHash);
          } else {
            done(new SecurityError(`Bad hash for tarball ${ref}. Expected ${expectHash} but ${actualHash}.`));
          }
        });

      request({
        url: ref,
        headers: {
          "User-Agent": constants.USER_AGENT,
          "Accept-Encoding": "gzip"
        }
      })
        .on("error", done)
        .on("redirect", function () {
          if (hash) return;

          let href = this.uri.href;
          let parts = url.parse(href);
          if (parts.protocol === "http:") {
            throw new SecurityError(`While downloading the tarball ${ref} we encountered a HTTP redirect of ${href}. This is not allowed unless a tarball hash is specified.`);
          }
        })
        .pipe(validateStream)
        .pipe(zlib.createUnzip())
        .on("error", done)
        .pipe(extractor);
    });
  }
}
