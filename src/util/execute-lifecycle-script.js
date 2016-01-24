/* @flow */

import * as constants from "../constants";
import { registries } from "../resolvers";
import * as child from "./child";

let path = require("path");

export default async function (cwd: string, cmds: Array<string>): Promise<Array<{
  cwd: string,
  command: string,
  stdout: string,
  stderr: string
}>> {
  let results = [];

  for (let cmd of cmds) {
    let env = Object.assign({}, process.env);

    // this is used in some places apparently..
    env.npm_execpath = path.join(__dirname, "..", "..", "bin", "kpm.js");

    // split up the path
    let pathParts = (env[constants.ENV_PATH_KEY] || "").split(path.delimiter);

    // add node-gyp
    pathParts.unshift(path.join(__dirname, "..", "..", "bin", "node-gyp-bin"));

    // add node_modules .bin
    for (let registry in registries) {
      pathParts.unshift(path.join(cwd, registries[registry].directory, ".bin"));
    }

    // join path back together
    env[constants.ENV_PATH_KEY] = pathParts.join(path.delimiter);

    let [stdout, stderr] = await child.exec(cmd, { cwd, env });
    results.push({ cwd, command: cmd, stdout, stderr });
  }

  return results;
}
