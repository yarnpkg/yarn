/* @flow */

import type Config from '../../config.js';
import type PackageResolver from '../../package-resolver.js';
import type PackageLinker from '../../package-linker.js';
import type {Reporter} from '../../reporters/index.js';
import type {HoistedTrees} from '../../hoisted-tree-builder.js';

import {promisify} from '../../util/promise.js';
import {buildTree as hoistedTreeBuilder} from '../../hoisted-tree-builder';
import {getTransitiveDevDependencies} from '../../util/get-transitive-dev-dependencies';
import {Install} from './install.js';
import Lockfile from '../../lockfile';
import {OWNED_DEPENDENCY_TYPES, YARN_REGISTRY} from '../../constants';

const zlib = require('zlib');
const gzip = promisify(zlib.gzip);

export type AuditOptions = {
  groups: Array<string>,
  level?: string,
};

export type AuditNode = {
  version: ?string,
  integrity: ?string,
  requires: Object,
  dependencies: {[string]: AuditNode},
  dev: boolean,
};

export type AuditTree = AuditNode & {
  install: Array<string>,
  remove: Array<string>,
  metadata: Object,
};

export type AuditVulnerabilityCounts = {
  info: number,
  low: number,
  moderate: number,
  high: number,
  critical: number,
};

export type AuditResolution = {
  id: number,
  path: string,
  dev: boolean,
  optional: boolean,
  bundled: boolean,
};

export type AuditAction = {
  action: string,
  module: string,
  target: string,
  isMajor: boolean,
  resolves: Array<AuditResolution>,
};

export type AuditAdvisory = {
  findings: [
    {
      version: string,
      paths: Array<string>,
      dev: boolean,
      optional: boolean,
      bundled: boolean,
    },
  ],
  id: number,
  created: string,
  updated: string,
  deleted: ?boolean,
  title: string,
  found_by: {
    name: string,
  },
  reported_by: {
    name: string,
  },
  module_name: string,
  cves: Array<string>,
  vulnerable_versions: string,
  patched_versions: string,
  overview: string,
  recommendation: string,
  references: string,
  access: string,
  severity: string,
  cwe: string,
  metadata: {
    module_type: string,
    exploitability: number,
    affected_components: string,
  },
  url: string,
};

export type AuditMetadata = {
  vulnerabilities: AuditVulnerabilityCounts,
  dependencies: number,
  devDependencies: number,
  optionalDependencies: number,
  totalDependencies: number,
};

export type AuditReport = {
  actions: Array<AuditAction>,
  advisories: {[string]: AuditAdvisory},
  muted: Array<Object>,
  metadata: AuditMetadata,
};

export type AuditActionRecommendation = {
  cmd: string,
  isBreaking: boolean,
  action: AuditAction,
};

export function setFlags(commander: Object) {
  commander.description('Checks for known security issues with the installed packages.');
  commander.option('--summary', 'Only print the summary.');
  commander.option(
    '--groups <group_name> [<group_name> ...]',
    `Only audit dependencies from listed groups. Default: ${OWNED_DEPENDENCY_TYPES.join(', ')}`,
    groups => groups.split(' '),
    OWNED_DEPENDENCY_TYPES,
  );
  commander.option(
    '--level <severity>',
    `Only print advisories with severity greater than or equal to one of the following: \
    info|low|moderate|high|critical. Default: info`,
    'info',
  );
}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<number> {
  const DEFAULT_LOG_LEVEL = 'info';
  const audit = new Audit(config, reporter, {
    groups: flags.groups || OWNED_DEPENDENCY_TYPES,
    level: flags.level || DEFAULT_LOG_LEVEL,
  });
  const lockfile = await Lockfile.fromDirectory(config.lockfileFolder, reporter);
  const install = new Install({}, config, reporter, lockfile);
  const {manifest, requests, patterns, workspaceLayout} = await install.fetchRequestFromCwd();
  await install.resolver.init(requests, {
    workspaceLayout,
  });

  const vulnerabilities = await audit.performAudit(manifest, lockfile, install.resolver, install.linker, patterns);

  const EXIT_INFO = 1;
  const EXIT_LOW = 2;
  const EXIT_MODERATE = 4;
  const EXIT_HIGH = 8;
  const EXIT_CRITICAL = 16;

  const exitCode =
    (vulnerabilities.info ? EXIT_INFO : 0) +
    (vulnerabilities.low ? EXIT_LOW : 0) +
    (vulnerabilities.moderate ? EXIT_MODERATE : 0) +
    (vulnerabilities.high ? EXIT_HIGH : 0) +
    (vulnerabilities.critical ? EXIT_CRITICAL : 0);

  if (flags.summary) {
    audit.summary();
  } else {
    audit.report();
  }

  return exitCode;
}

export default class Audit {
  severityLevels = ['info', 'low', 'moderate', 'high', 'critical'];

  constructor(config: Config, reporter: Reporter, options: AuditOptions) {
    this.config = config;
    this.reporter = reporter;
    this.options = options;
  }

  config: Config;
  reporter: Reporter;
  options: AuditOptions;
  auditData: AuditReport;

  _mapHoistedNodes(auditNode: AuditNode, hoistedNodes: HoistedTrees, transitiveDevDeps: Set<string>) {
    for (const node of hoistedNodes) {
      const pkg = node.manifest.pkg;
      const requires = Object.assign({}, pkg.dependencies || {}, pkg.optionalDependencies || {});
      for (const name of Object.keys(requires)) {
        if (!requires[name]) {
          requires[name] = '*';
        }
      }
      auditNode.dependencies[node.name] = {
        version: node.version,
        integrity: pkg._remote ? pkg._remote.integrity || '' : '',
        requires,
        dependencies: {},
        dev: transitiveDevDeps.has(`${node.name}@${node.version}`),
      };
      if (node.children) {
        this._mapHoistedNodes(auditNode.dependencies[node.name], node.children, transitiveDevDeps);
      }
    }
  }

  _mapHoistedTreesToAuditTree(manifest: Object, hoistedTrees: HoistedTrees, transitiveDevDeps: Set<string>): AuditTree {
    const requiresGroups = this.options.groups.map(function(group: string): Object {
      return manifest[group] || {};
    });

    const auditTree: AuditTree = {
      name: manifest.name || undefined,
      version: manifest.version || undefined,
      install: [],
      remove: [],
      metadata: {
        //TODO: What do we send here? npm sends npm version, node version, etc.
      },
      requires: Object.assign({}, ...requiresGroups),
      integrity: undefined,
      dependencies: {},
      dev: false,
    };

    this._mapHoistedNodes(auditTree, hoistedTrees, transitiveDevDeps);
    return auditTree;
  }

  async _fetchAudit(auditTree: AuditTree): Object {
    let responseJson;
    const registry = YARN_REGISTRY;
    this.reporter.verbose(`Audit Request: ${JSON.stringify(auditTree, null, 2)}`);
    const requestBody = await gzip(JSON.stringify(auditTree));
    const response = await this.config.requestManager.request({
      url: `${registry}/-/npm/v1/security/audits`,
      method: 'POST',
      body: requestBody,
      headers: {
        'Content-Encoding': 'gzip',
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    try {
      responseJson = JSON.parse(response);
    } catch (ex) {
      throw new Error(`Unexpected audit response (Invalid JSON): ${response}`);
    }
    if (!responseJson.metadata) {
      throw new Error(`Unexpected audit response (Missing Metadata): ${JSON.stringify(responseJson, null, 2)}`);
    }
    this.reporter.verbose(`Audit Response: ${JSON.stringify(responseJson, null, 2)}`);
    return responseJson;
  }

  _insertWorkspacePackagesIntoManifest(manifest: Object, resolver: PackageResolver) {
    if (resolver.workspaceLayout) {
      const workspaceAggregatorName = resolver.workspaceLayout.virtualManifestName;
      const workspaceManifest = resolver.workspaceLayout.workspaces[workspaceAggregatorName].manifest;

      manifest.dependencies = Object.assign(manifest.dependencies || {}, workspaceManifest.dependencies);
      manifest.devDependencies = Object.assign(manifest.devDependencies || {}, workspaceManifest.devDependencies);
      manifest.optionalDependencies = Object.assign(
        manifest.optionalDependencies || {},
        workspaceManifest.optionalDependencies,
      );
    }
  }

  async performAudit(
    manifest: Object,
    lockfile: Lockfile,
    resolver: PackageResolver,
    linker: PackageLinker,
    patterns: Array<string>,
  ): Promise<AuditVulnerabilityCounts> {
    this._insertWorkspacePackagesIntoManifest(manifest, resolver);
    const transitiveDevDeps = getTransitiveDevDependencies(manifest, resolver.workspaceLayout, lockfile);
    const hoistedTrees = await hoistedTreeBuilder(resolver, linker, patterns);
    const auditTree = this._mapHoistedTreesToAuditTree(manifest, hoistedTrees, transitiveDevDeps);
    this.auditData = await this._fetchAudit(auditTree);
    return this.auditData.metadata.vulnerabilities;
  }

  summary() {
    if (!this.auditData) {
      return;
    }
    this.reporter.auditSummary(this.auditData.metadata);
  }

  report() {
    if (!this.auditData) {
      return;
    }

    const startLoggingAt: number = Math.max(0, this.severityLevels.indexOf(this.options.level));

    const reportAdvisory = (resolution: AuditResolution) => {
      const advisory = this.auditData.advisories[resolution.id.toString()];

      if (this.severityLevels.indexOf(advisory.severity) >= startLoggingAt) {
        this.reporter.auditAdvisory(resolution, advisory);
      }
    };

    if (Object.keys(this.auditData.advisories).length !== 0) {
      // let printedManualReviewHeader = false;

      this.auditData.actions.forEach(action => {
        action.resolves.forEach(reportAdvisory);

        /* The following block has been temporarily removed
         * because the actions returned by npm are not valid for yarn.
         * Removing this action reporting until we can come up with a way
         * to correctly resolve issues.
         */
        // if (action.action === 'update' || action.action === 'install') {
        //   // these advisories can be resolved automatically by running a yarn command
        //   const recommendation: AuditActionRecommendation = {
        //     cmd: `yarn upgrade ${action.module}@${action.target}`,
        //     isBreaking: action.isMajor,
        //     action,
        //   };
        //   this.reporter.auditAction(recommendation);
        //   action.resolves.forEach(reportAdvisory);
        // }

        // if (action.action === 'review') {
        //   // these advisories cannot be resolved automatically and require manual review
        //   if (!printedManualReviewHeader) {
        //     this.reporter.auditManualReview();
        //   }
        //   printedManualReviewHeader = true;
        //   action.resolves.forEach(reportAdvisory);
        // }
      });
    }

    this.summary();
  }
}
