// @flow

const {
  tests: {generatePkgDriver, startPackageServer, getPackageRegistry},
  exec: {execFile},
} = require(`pkg-tests-core`);

const {basic: basicSpecs, dragon: dragonSpecs} = require(`pkg-tests-specs`);

const pkgDriver = generatePkgDriver({
  runDriver: (path, args, {registryUrl}) => {
    const extraArgs = [`--cache-folder`, `${path}/.cache`];
    return execFile(process.execPath, [`${process.cwd()}/../../dist/bin/yarn.js`, ...extraArgs, ...args], {
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
