/* @flow */

const {
  tests: {generatePkgDriver, startPackageServer, getPackageRegistry},
  exec: {execFile},
} = require(`pkg-tests-core`);

const {basic: basicSpecs, dragon: dragonSpecs, pnp: pnpSpecs} = require(`pkg-tests-specs`);

const pkgDriver = generatePkgDriver({
  runDriver: (path, [command, ...args], {registryUrl, plugNPlay}) => {
    let extraArgs = [];

    if (command !== 'node') {
      extraArgs = [...extraArgs, `--cache-folder`, `${path}/.cache`];
    }

    if (plugNPlay) {
      extraArgs;
    }

    return execFile(process.execPath, [`${process.cwd()}/../../bin/yarn.js`, command, ...extraArgs, ...args], {
      env: {[`NPM_CONFIG_REGISTRY`]: registryUrl, [`YARN_SILENT`]: `1`},
      cwd: path,
    });
  },
});

beforeEach(async () => {
  await startPackageServer();
  await getPackageRegistry();
});

basicSpecs(pkgDriver);
dragonSpecs(pkgDriver);
pnpSpecs(pkgDriver);
