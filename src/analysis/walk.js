/* @flow */

import type { AnalysisFileEntry as File } from "../types.js";
import * as utilFs from "../util/fs.js";

let crypto = require("crypto");
let fs     = require("fs");

function readFile(loc: string): Promise<{
  binary: boolean,
  buffer: ?Buffer,
  hash: string
}> {
  return new Promise((resolve, reject) => {
    let binary = false;
    let chunks = [];
    let stream = fs.createReadStream(loc);
    let hash   = crypto.createHash("sha1");

    function isBinary() {
      chunks = [];
      binary = true;
    }

    // handle stream errors
    stream.on("error", reject);

    // catch all chunks, push them onto the chunks array, break on NULL character
    stream.on("data", function (chunk) {
      hash.update(chunk);

      if (binary) return;
      chunks.push(chunk);

      for (let cha of chunk) {
        if (cha === 0x00) {
          isBinary();
        }
      }
    });

    stream.on("close", function () {
      resolve({
        binary,
        buffer: binary ? null : Buffer.concat(chunks),
        hash: hash.digest("hex")
      });
    });
  });
}

export default async function walk(dir: string): Promise<Array<File>> {
  let files: Array<File> = [];

  for (let file of await utilFs.walk(dir)) {
    let stat = await utilFs.lstat(file.absolute);

    let stats = {
      absolute: file.absolute,
      relative: file.relative,
      size: stat.size,
      mode: stat.mode
    };

    if (stat.isFile()) {
      let info = await readFile(stats.absolute);

      files.push({
        type: info.binary ? "binary" : "file",
        ...info,
        ...stats
      });
    } else if (stat.isSymbolicLink()) {
      files.push({
        type: "symlink",
        location: await utilFs.realpath(stats.absolute),
        ...stats
      });
    } else {
      continue;
    }
  }

  return files;
}
