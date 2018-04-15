/* @flow */
import path from 'path';
import {IGNORE_MANIFEST_KEYS, makeEnv} from '../../src/util/execute-lifecycle-script';
import Config from '../../src/config';
import {NoopReporter} from '../../src/reporters';

const cwd = path.resolve(__dirname);

const initConfig = async cfg => {
  const reporter = new NoopReporter();
  const config = new Config(reporter);
  await config.init(cfg);
  return config;
};

const withManifest = async (stage, value, keys = {}) => {
  const config = await initConfig({});
  config.maybeReadManifest = dir => {
    expect(dir).toEqual(cwd);
    return Promise.resolve({
      scripts: {[stage]: value},
      ...keys,
    });
  };
  return config;
};

describe('makeEnv', () => {
  it('assigns npm_lifecycle_event to env', async () => {
    const stage = 'my-script';
    const config = await initConfig({});
    const env = await makeEnv(stage, cwd, config);
    expect(env.npm_lifecycle_event).toEqual(stage);
  });

  it('assigns NODE_ENV production', async () => {
    const config = await initConfig({production: true});
    const env = await makeEnv('test-script', cwd, config);
    expect(env.NODE_ENV).toEqual('production');
  });

  it('assigns INIT_CWD to env', async () => {
    const config = await initConfig();
    const env = await makeEnv('test-script', cwd, config);
    expect(env.INIT_CWD).toEqual(process.cwd());
  });

  describe('npm_package_*', () => {
    it('assigns npm_lifecycle_script if manifest has a matching script', async () => {
      const stage = 'test-script';
      const value = 'run this script';
      const config = await withManifest(stage, value);
      const env = await makeEnv(stage, cwd, config);
      expect(env.npm_lifecycle_script).toEqual(value);
    });

    it('does not overwrite npm_lifecycle_script if manifest does not have a matching script', async () => {
      const stage = 'test-script';
      const config = await withManifest('wrong-stage', 'new value');
      const env = await makeEnv(stage, cwd, config);
      expect(env.npm_lifecycle_script).toEqual(process.env.npm_lifecycle_script);
    });

    it('recursively adds keys separated by _', async () => {
      const config = await withManifest('', '', {
        top: 'first',
        recursive: {
          key: 'value',
          more: {another: 'what'},
        },
      });
      const env = await makeEnv('', cwd, config);
      expect(env['npm_package_top']).toEqual('first');
      expect(env['npm_package_recursive_key']).toEqual('value');
      expect(env['npm_package_recursive_more_another']).toEqual('what');
    });

    it('replaces invalid chars with _', async () => {
      const config = await withManifest('', '', {'in^va!d_key': 'test'});
      const env = await makeEnv('', cwd, config);
      expect(env['npm_package_in_va_d_key']).toEqual('test');
    });

    it('it omits certain fields which tend to be too large', async () => {
      const testManifest = {hello: 'I shall stay'};
      for (const key of IGNORE_MANIFEST_KEYS) {
        testManifest[key] = 'some long text we want to omit';
        // ensure we don't carry an previously set environment variables for these
        // to make tests consistent across runs with
        delete process.env[`npm_package_${key}`];
      }

      const config = await withManifest('', '', testManifest);
      const env = await makeEnv('', cwd, config);

      expect(env).toHaveProperty('npm_package_hello', 'I shall stay');
      for (const key of IGNORE_MANIFEST_KEYS) {
        expect(env).not.toHaveProperty(`npm_package_${key}`);
      }
    });
  });

  describe('npm_package_config_*', () => {
    it('overwrites npm_package_config_* keys from yarn config or npm config', async () => {
      const name = 'manifest-name';
      const config = await withManifest('', '', {name, config: {key: 'value', keytwo: 'valuetwo'}});
      config.registries.yarn.config = {[`${name}:key`]: 'replaced'};
      config.registries.npm.config = {[`${name}:keytwo`]: 'also replaced'};
      const env = await makeEnv('', cwd, config);
      expect(env['npm_package_config_key']).toEqual('replaced');
      expect(env['npm_package_config_keytwo']).toEqual('also replaced');
    });

    it('does not overwrite if the name does not match the manifest', async () => {
      const name = 'manifest-name';
      const config = await withManifest('', '', {name, config: {key: 'value', keytwo: 'valuetwo'}});
      config.registries.yarn.config = {'wrong-name:key': 'replaced'};
      config.registries.npm.config = {'another-name:keytwo': 'also replaced'};
      const env = await makeEnv('', cwd, config);
      expect(env['npm_package_config_key']).toEqual('value');
      expect(env['npm_package_config_keytwo']).toEqual('valuetwo');
    });
  });
});
