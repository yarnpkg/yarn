/* @flow */

const {delimiter} = require(`path`);

const {
  tests: {generatePkgDriver, startPackageServer, getPackageRegistry},
  exec: {execFile},
} = require(`pkg-tests-core`);

const {
  basic: basicSpecs,
  dragon: dragonSpecs,
  lock: lockSpecs,
  pnp: pnpSpecs,
  pnpapiV1: pnpapiV1Specs,
  script: scriptSpecs,
  workspace: workspaceSpecs,
} = require(`pkg-tests-specs`);

const pkgDriver = generatePkgDriver({
  async runDriver(
    path,
    [command, ...args],
    {cwd, projectFolder, registryUrl, plugNPlay, plugnplayShebang, plugnplayBlacklist, env},
  ) {
    let beforeArgs = [];
    let middleArgs = [];

    if (projectFolder) {
      beforeArgs = [...beforeArgs, `--cwd`, projectFolder];
    }

    if (command === 'install') {
      middleArgs = [...middleArgs, `--cache-folder`, `${path}/.cache`];
    }

    const res = await execFile(
      process.execPath,
      [`${process.cwd()}/../../bin/yarn.js`, ...beforeArgs, command, ...middleArgs, ...args],
      {
        env: Object.assign(
          {
            [`NPM_CONFIG_REGISTRY`]: registryUrl,
            [`YARN_SILENT`]: `1`,
            [`YARN_PROXY`]: ``,
            [`YARN_HTTPS_PROXY`]: ``,
            [`YARN_PLUGNPLAY_SHEBANG`]: plugnplayShebang || ``,
            [`YARN_PLUGNPLAY_BLACKLIST`]: plugnplayBlacklist || ``,
            [`PATH`]: `${path}/bin${delimiter}${process.env.PATH}`,
          },
          plugNPlay ? {[`YARN_PLUGNPLAY_OVERRIDE`]: plugNPlay ? `1` : `0`} : {},
          env,
        ),
        cwd: cwd || path,
      },
    );

    if (process.env.JEST_LOG_SPAWNS) {
      console.log(`===== stdout:`);
      console.log(res.stdout);
      console.log(`===== stderr:`);
      console.log(res.stderr);
    }

    return res;
  },
});

if (process.platform === `win32`) {
  jest.setTimeout(10000);
}

beforeEach(async () => {
  await startPackageServer();
  await getPackageRegistry();
});

basicSpecs(pkgDriver);
lockSpecs(pkgDriver);
scriptSpecs(pkgDriver);
workspaceSpecs(pkgDriver);
pnpSpecs(pkgDriver);
pnpapiV1Specs(pkgDriver);
dragonSpecs(pkgDriver);
