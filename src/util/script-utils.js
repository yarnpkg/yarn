/* @flow */

import * as fs from './fs.js';
import type {Reporter} from '../reporters/index.js';

export async function checkImportScripts(scripts: string || Object, reporter: Reporter): Promise<Object> {
  if (typeof scripts === 'string' && scripts.length > 0) {
    if (await fs.exists(scripts)) {
      const module = require(await fs.realpath(scripts));
      if (module && typeof module.scripts === 'object') {
        scripts = iterateScripts(module.scripts, '', module.delimiter, reporter);
      } else {
        reporter &&
          reporter.warn(
            `Invalid scripts module: ${scripts}.  The module must be exported and include a root scripts object.`,
          );
      }
    }
  }
  return scripts;
}

function iterateScripts(node: Object, path: string = '', delim: string = '.', reporter: Reporter): Object {
  const scripts = {};

  const addScript = (key, script) => {
    scripts[key] &&
      reporter &&
      reporter.warn(`Duplicate script key detected: ${key}.  Scripts should be structured to have unique keys.`);
    scripts[key] = script;
  };

  if (node['script'] && typeof node['script'] === 'string') {
    addScript(path, node['script']); // Add script, ignore other non object keys
  } else {
    Object.keys(node).filter(k => typeof node[k] === 'string').forEach(k => {
      if (k === 'default') {
        addScript(path, node[k]);
      } else {
        addScript([path, k].filter(Boolean).join(delim), node[k]);
      }
    });
  }

  // Process remaining object nodes
  Object.keys(node).filter(k => typeof node[k] === 'object').forEach(k => {
    const nodepath = k === 'default' ? path : [path, k].filter(Boolean).join(delim);
    const iteratedScripts = iterateScripts(node[k], nodepath, delim, reporter);
    Object.keys(iteratedScripts).forEach(k => addScript(k, iteratedScripts[k]));
  });
  return scripts;
}
