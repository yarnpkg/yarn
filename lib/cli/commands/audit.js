'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.run = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let run = exports.run = (() => {
  var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    const DEFAULT_LOG_LEVEL = 'info';
    const audit = new Audit(config, reporter, {
      groups: flags.groups || (_constants || _load_constants()).OWNED_DEPENDENCY_TYPES,
      level: flags.level || DEFAULT_LOG_LEVEL
    });
    const lockfile = yield (_lockfile || _load_lockfile()).default.fromDirectory(config.lockfileFolder, reporter);
    const install = new (_install || _load_install()).Install({}, config, reporter, lockfile);

    var _ref2 = yield install.fetchRequestFromCwd();

    const manifest = _ref2.manifest,
          requests = _ref2.requests,
          patterns = _ref2.patterns,
          workspaceLayout = _ref2.workspaceLayout;

    yield install.resolver.init(requests, {
      workspaceLayout
    });

    const vulnerabilities = yield audit.performAudit(manifest, lockfile, install.resolver, install.linker, patterns);

    const EXIT_INFO = 1;
    const EXIT_LOW = 2;
    const EXIT_MODERATE = 4;
    const EXIT_HIGH = 8;
    const EXIT_CRITICAL = 16;

    const exitCode = (vulnerabilities.info ? EXIT_INFO : 0) + (vulnerabilities.low ? EXIT_LOW : 0) + (vulnerabilities.moderate ? EXIT_MODERATE : 0) + (vulnerabilities.high ? EXIT_HIGH : 0) + (vulnerabilities.critical ? EXIT_CRITICAL : 0);

    if (flags.summary) {
      audit.summary();
    } else {
      audit.report();
    }

    return exitCode;
  });

  return function run(_x, _x2, _x3, _x4) {
    return _ref.apply(this, arguments);
  };
})();

exports.setFlags = setFlags;
exports.hasWrapper = hasWrapper;

var _promise;

function _load_promise() {
  return _promise = require('../../util/promise.js');
}

var _hoistedTreeBuilder;

function _load_hoistedTreeBuilder() {
  return _hoistedTreeBuilder = require('../../hoisted-tree-builder');
}

var _getTransitiveDevDependencies;

function _load_getTransitiveDevDependencies() {
  return _getTransitiveDevDependencies = require('../../util/get-transitive-dev-dependencies');
}

var _install;

function _load_install() {
  return _install = require('./install.js');
}

var _lockfile;

function _load_lockfile() {
  return _lockfile = _interopRequireDefault(require('../../lockfile'));
}

var _constants;

function _load_constants() {
  return _constants = require('../../constants');
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const zlib = require('zlib');

const gzip = (0, (_promise || _load_promise()).promisify)(zlib.gzip);

function setFlags(commander) {
  commander.description('Checks for known security issues with the installed packages.');
  commander.option('--summary', 'Only print the summary.');
  commander.option('--groups <group_name> [<group_name> ...]', `Only audit dependencies from listed groups. Default: ${(_constants || _load_constants()).OWNED_DEPENDENCY_TYPES.join(', ')}`, groups => groups.split(' '), (_constants || _load_constants()).OWNED_DEPENDENCY_TYPES);
  commander.option('--level <severity>', `Only print advisories with severity greater than or equal to one of the following: \
    info|low|moderate|high|critical. Default: info`, 'info');
}

function hasWrapper(commander, args) {
  return true;
}

class Audit {

  constructor(config, reporter, options) {
    this.severityLevels = ['info', 'low', 'moderate', 'high', 'critical'];

    this.config = config;
    this.reporter = reporter;
    this.options = options;
  }

  _mapHoistedNodes(auditNode, hoistedNodes, transitiveDevDeps) {
    for (var _iterator = hoistedNodes, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
      var _ref3;

      if (_isArray) {
        if (_i >= _iterator.length) break;
        _ref3 = _iterator[_i++];
      } else {
        _i = _iterator.next();
        if (_i.done) break;
        _ref3 = _i.value;
      }

      const node = _ref3;

      const pkg = node.manifest.pkg;
      const requires = Object.assign({}, pkg.dependencies || {}, pkg.optionalDependencies || {});
      for (var _iterator2 = Object.keys(requires), _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
        var _ref4;

        if (_isArray2) {
          if (_i2 >= _iterator2.length) break;
          _ref4 = _iterator2[_i2++];
        } else {
          _i2 = _iterator2.next();
          if (_i2.done) break;
          _ref4 = _i2.value;
        }

        const name = _ref4;

        if (!requires[name]) {
          requires[name] = '*';
        }
      }
      auditNode.dependencies[node.name] = {
        version: node.version,
        integrity: pkg._remote ? pkg._remote.integrity || '' : '',
        requires,
        dependencies: {},
        dev: transitiveDevDeps.has(`${node.name}@${node.version}`)
      };
      if (node.children) {
        this._mapHoistedNodes(auditNode.dependencies[node.name], node.children, transitiveDevDeps);
      }
    }
  }

  _mapHoistedTreesToAuditTree(manifest, hoistedTrees, transitiveDevDeps) {
    const requiresGroups = this.options.groups.map(function (group) {
      return manifest[group] || {};
    });

    const auditTree = {
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
      dev: false
    };

    this._mapHoistedNodes(auditTree, hoistedTrees, transitiveDevDeps);
    return auditTree;
  }

  _fetchAudit(auditTree) {
    var _this = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      let responseJson;
      const registry = (_constants || _load_constants()).YARN_REGISTRY;
      _this.reporter.verbose(`Audit Request: ${JSON.stringify(auditTree, null, 2)}`);
      const requestBody = yield gzip(JSON.stringify(auditTree));
      const response = yield _this.config.requestManager.request({
        url: `${registry}/-/npm/v1/security/audits`,
        method: 'POST',
        body: requestBody,
        headers: {
          'Content-Encoding': 'gzip',
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }
      });

      try {
        responseJson = JSON.parse(response);
      } catch (ex) {
        throw new Error(`Unexpected audit response (Invalid JSON): ${response}`);
      }
      if (!responseJson.metadata) {
        throw new Error(`Unexpected audit response (Missing Metadata): ${JSON.stringify(responseJson, null, 2)}`);
      }
      _this.reporter.verbose(`Audit Response: ${JSON.stringify(responseJson, null, 2)}`);
      return responseJson;
    })();
  }

  _insertWorkspacePackagesIntoManifest(manifest, resolver) {
    if (resolver.workspaceLayout) {
      const workspaceAggregatorName = resolver.workspaceLayout.virtualManifestName;
      const workspaceManifest = resolver.workspaceLayout.workspaces[workspaceAggregatorName].manifest;

      manifest.dependencies = Object.assign(manifest.dependencies || {}, workspaceManifest.dependencies);
      manifest.devDependencies = Object.assign(manifest.devDependencies || {}, workspaceManifest.devDependencies);
      manifest.optionalDependencies = Object.assign(manifest.optionalDependencies || {}, workspaceManifest.optionalDependencies);
    }
  }

  performAudit(manifest, lockfile, resolver, linker, patterns) {
    var _this2 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      _this2._insertWorkspacePackagesIntoManifest(manifest, resolver);
      const transitiveDevDeps = (0, (_getTransitiveDevDependencies || _load_getTransitiveDevDependencies()).getTransitiveDevDependencies)(manifest, resolver.workspaceLayout, lockfile);
      const hoistedTrees = yield (0, (_hoistedTreeBuilder || _load_hoistedTreeBuilder()).buildTree)(resolver, linker, patterns);
      const auditTree = _this2._mapHoistedTreesToAuditTree(manifest, hoistedTrees, transitiveDevDeps);
      _this2.auditData = yield _this2._fetchAudit(auditTree);
      return _this2.auditData.metadata.vulnerabilities;
    })();
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

    const startLoggingAt = Math.max(0, this.severityLevels.indexOf(this.options.level));

    const reportAdvisory = resolution => {
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
exports.default = Audit;