/* @flow */

import type Config from '../../config.js';
import type {Reporter} from '../../reporters/index.js';

import {run as hoistedTreeBuilder} from '../../hoisted-tree-builder';
import {Install} from './install.js';
import Lockfile from '../../lockfile';
import {YARN_REGISTRY} from '../../constants';

export type AuditNode = {
  version: string,
  integrity: string,
  requires: Object,
  dependencies: Object, // <string, AuditNode>
};

export type AuditTree = AuditNode & {
  install: Array<string>,
  remove: Array<string>,
  metadata: Object,
};

export function setFlags(commander: Object) {
  commander.description('Checks for known security issues with the installed packages.');
  commander.option('--summary', 'Only print the summary.');
}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  const audit = new Audit(config, reporter);
  await audit.report();
}

export class Audit {
  constructor(config: Config, reporter: Reporter) {
    this.config = config;
    this.reporter = reporter;
  }

  _mapHoistedNodes(auditNode: AuditTree, hoistedNodes: HoistManifest) {
    for (const node of hoistedNodes) {
      const pkg = node.manifest.pkg;
      auditNode.dependencies[node.name] = {
        version: node.version,
        integrity: pkg.integrity || '', // TODO: what do we do for deps that don't have an integrity?
        requires: Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {}, pkg.optionalDependencies || {}),
        dependencies: {},
      };

      if (node.children) {
        this._mapHoistedNodes(auditNode.dependencies[node.name], node.children);
      }
    }
  }

  _mapHoistedTreesToAuditTree(manifest: Manifest, hoistedTrees: Tree): AuditTree {
    const auditTree: AuditTree = {
      name: manifest.name,
      version: manifest.version,
      install: [],
      remove: [],
      metadata: {
        //TODO: What do we send here? npm sends npm version, ndoe version, etc.
      },
      requires: Object.assign(
        {},
        manifest.dependencies || {},
        manifest.devDependencies || {},
        manifest.optionalDependencies || {},
      ),
      dependencies: {},
    };

    this._mapHoistedNodes(auditTree, hoistedTrees);
    return auditTree;
  }

  async report(summary: boolean = false): Promise<void> {
    const lockfile = await Lockfile.fromDirectory(this.config.lockfileFolder, this.reporter);
    const install = new Install({}, this.config, this.reporter, lockfile);
    const {manifest} = await install.fetchRequestFromCwd();

    const hoistedTrees = await hoistedTreeBuilder(this.config, this.reporter);
    const auditTree = this._mapHoistedTreesToAuditTree(manifest, hoistedTrees);
    const registry = YARN_REGISTRY;
    // console.log(JSON.stringify(auditTree, null, 2));

    try {
      const response = await this.config.requestManager.request({
        url: `${registry}/-/npm/v1/security/audits`,
        method: 'POST',
        body: auditTree,
        json: true,
      });
      // console.log(JSON.stringify(response, null, 2));
      this.reporter.auditSummary(response);
    } catch (ex) {
      this.reporter.error(ex);
      throw ex;
    }
  }
}
