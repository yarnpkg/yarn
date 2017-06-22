/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {MessageError} from '../../errors.js';

async function getCredentials(
  config: Config,
  reporter: Reporter,
): Promise<?{
  username: string,
  email: string,
}> {
  let {username, email} = config.registries.yarn.config;

  if (username) {
    reporter.info(`${reporter.lang('npmUsername')}: ${username}`);
  } else {
    username = await reporter.question(reporter.lang('npmUsername'));
    if (!username) {
      return null;
    }
  }

  if (email) {
    reporter.info(`${reporter.lang('npmEmail')}: ${email}`);
  } else {
    email = await reporter.question(reporter.lang('npmEmail'));
    if (!email) {
      return null;
    }
  }

  await config.registries.yarn.saveHomeConfig({username, email});

  return {username, email};
}

export async function getToken(config: Config, reporter: Reporter, name: string = ''): Promise<() => Promise<void>> {
  const auth = config.registries.npm.getAuth(name);
  if (auth) {
    config.registries.npm.setToken(auth);
    return function revoke(): Promise<void> {
      reporter.info(reporter.lang('notRevokingConfigToken'));
      return Promise.resolve();
    };
  }

  const env = process.env.YARN_AUTH_TOKEN || process.env.NPM_AUTH_TOKEN;
  if (env) {
    config.registries.npm.setToken(`Bearer ${env}`);
    return function revoke(): Promise<void> {
      reporter.info(reporter.lang('notRevokingEnvToken'));
      return Promise.resolve();
    };
  }

  //
  const creds = await getCredentials(config, reporter);
  if (!creds) {
    reporter.warn(reporter.lang('loginAsPublic'));
    return function revoke(): Promise<void> {
      reporter.info(reporter.lang('noTokenToRevoke'));
      return Promise.resolve();
    };
  }

  const {username, email} = creds;
  const password = await reporter.question(reporter.lang('npmPassword'), {
    password: true,
    required: true,
  });

  //
  const userobj = {
    _id: `org.couchdb.user:${username}`,
    name: username,
    password,
    email,
    type: 'user',
    roles: [],
    date: new Date().toISOString(),
  };

  //
  const res = await config.registries.npm.request(`-/user/org.couchdb.user:${encodeURIComponent(username)}`, {
    method: 'PUT',
    body: userobj,
    auth: {username, password, email},
  });

  if (res && res.ok) {
    reporter.success(reporter.lang('loggedIn'));

    const token = res.token;
    config.registries.npm.setToken(`Bearer ${token}`);

    return async function revoke(): Promise<void> {
      reporter.success(reporter.lang('revokedToken'));
      await config.registries.npm.request(`-/user/token/${token}`, {
        method: 'DELETE',
      });
    };
  } else {
    throw new MessageError(reporter.lang('incorrectCredentials'));
  }
}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export function setFlags(commander: Object) {}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  await getCredentials(config, reporter);
}
