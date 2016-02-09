/* @flow */

import type { AnalysisFileEntry as File } from "../types.js";
import * as utilFs from "../util/fs.js";

let fileType = require("file-type");
let crypto   = require("crypto");
let fs       = require("fs");

function readFile(loc: string): Promise<{
  binary: boolean,
  content: ?Buffer,
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

    // when we first get a chunk of data, check if it identifies as a binary file, if so
    // mark it as binary
    stream.once("data", function (chunk) {
      if (fileType(chunk)) {
        isBinary();
      }
    });

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
        content: binary ? null : Buffer.concat(chunks),
        hash: hash.digest("hex")
      });
    });
  });
}

export default async function walk(dir: string): Promise<Array<File>> {
  let files = [];

  for (let file of await utilFs.walk(dir)) {
    let stat = await utilFs.lstat(file.absolute);

    let entry = {
      absolute: file.absolute,
      relative: file.relative,
      type: "binary",
      content: null,
      size: stat.size,
      mode: stat.mode,
      hash: ""
    };

    if (stat.isFile()) {
      let read = await readFile(entry.absolute);
      if (read.hash) {
        entry.hash = read.hash;
      }
      if (!read.binary && read.content) {
        entry.content = read.content;
        entry.type    = "file";
      }
    } else if (stat.isSymbolicLink()) {
      entry.content = await utilFs.realpath(entry.absolute);
      entry.type = "symlink";
    } else {
      // TODO ???
      continue;
    }

    files.push(entry);
  }

  return files;
}
