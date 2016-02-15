/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

import TarballFetcher from "../src/fetchers/tarball";
import BaseFetcher from "../src/fetchers/_base";
import CopyFetcher from "../src/fetchers/copy";
import GitFetcher from "../src/fetchers/git";
import Config from "../src/config";
import mkdir from "./_temp.js";
import * as fs from "../src/util/fs.js";

let path = require("path");
let test = require("ava");

async function createConfig() {
  let config = new Config;
  await config.init();
  return config;
}

test("BaseFetcher.fetch", async (t) => {
  let dir = await mkdir("base-fetcher");
  let fetcher = new BaseFetcher({
    type: "",
    registry: "npm",
    reference: ""
  }, await createConfig());
  t.throws(fetcher.fetch(dir), "Not implemented");
});

test("CopyFetcher.fetch", async (t) => {
  let a = await mkdir("copy-fetcher-a");
  await fs.writeFile(path.join(a, "package.json"), "{}");
  await fs.writeFile(path.join(a, "foo"), "bar");

  let b = await mkdir("copy-fetcher-b");
  let fetcher = new CopyFetcher({
    type: "copy",
    reference: a,
    registry: "npm"
  }, await createConfig());
  await fetcher.fetch(b);
  t.is(await fs.readFile(path.join(b, "package.json")), "{}");
  t.is(await fs.readFile(path.join(b, "foo")), "bar");
});

test("GitFetcher.fetch", async (t) => {
  let dir = await mkdir("git-fetcher");
  let fetcher = new GitFetcher({
    type: "git",
    reference: "https://github.com/PolymerElements/font-roboto",
    hash: "2fd5c7bd715a24fb5b250298a140a3ba1b71fe46",
    registry: "bower"
  }, await createConfig());
  await fetcher.fetch(dir);
  t.is((await fs.readJson(path.join(dir, "bower.json"))).name, "font-roboto");
});

test("TarballFetcher.fetch", async (t) => {
  let dir = await mkdir("tarball-fetcher");
  let fetcher = new TarballFetcher({
    type: "tarball",
    hash: "9689b3b48d63ff70f170a192bec3c01b04f58f45",
    reference: "https://github.com/PolymerElements/font-roboto/archive/2fd5c7bd715a24fb5b250298a140a3ba1b71fe46.tar.gz",
    registry: "bower"
  }, await createConfig());
  await fetcher.fetch(dir);
  t.is((await fs.readJson(path.join(dir, "bower.json"))).name, "font-roboto");
});


test("TarballFetcher.fetch", async (t) => {
  let dir = await mkdir("tarball-fetcher");
  let url = "https://github.com/PolymerElements/font-roboto/archive/2fd5c7bd715a24fb5b250298a140a3ba1b71fe46.tar.gz";
  let fetcher = new TarballFetcher({
    type: "tarball",
    hash: "foo",
    reference: url,
    registry: "bower"
  }, await createConfig());
  t.throws(fetcher.fetch(dir), `${url}: Bad hash. Expected foo but got 9689b3b48d63ff70f170a192bec3c01b04f58f45`);
});

test("TarballFetcher.fetch plain http error", async (t) => {
  let dir = await mkdir("tarball-fetcher");
  let fetcher = new TarballFetcher({
    type: "tarball",
    reference: "http://example.com/",
    registry: "npm"
  }, await createConfig());
  t.throws(fetcher.fetch(dir), "http://example.com/: Refusing to fetch tarball over plain HTTP without a hash");
});
