/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {MessageError} from '../../errors.js';

async function getCredentials(config: Config, reporter: Reporter): Promise<?{
  username: string,
  email: string,
}> {
  let kpmConfig = config.registries.kpm.config;

  let username = kpmConfig.username;
  if (username) {
    reporter.info(`${reporter.lang('npmUsername')}: ${username}`);
  } else {
    username = await reporter.question(reporter.lang('npmUsername'));
    if (!username) {
      return null;
    }
  }

  let email = kpmConfig.email;
  if (email) {
    reporter.info(`${reporter.lang('npmUsername')}: ${email}`);
  } else {
    email = await reporter.question(reporter.lang('npmEmail'));
    if (!email) {
      return null;
    }
  }

  await config.registries.kpm.saveHomeConfig({username, email});

  return {username, email};
}

export async function getToken(config: Config, reporter: Reporter): Promise<
  () => Promise<void>
> {
  let env = process.env.KPM_AUTH_TOKEN || process.env.NPM_AUTH_TOKEN;
  if (env) {
    config.registries.npm.setToken(env);
    return async function revoke() {
      reporter.info(reporter.lang('notRevokingEnvToken'));
    };
  }

  let requestManager = config.requestManager;

  //
  let creds = await getCredentials(config, reporter);
  if (!creds) {
    reporter.warn(reporter.lang('loginAsPublic'));
    return async function revoke() {
      reporter.info(reporter.lang('noTokenToRevoke'));
    };
  }

  let {username, email} = creds;
  let password = await reporter.question(reporter.lang('npmPassword'), true);

  //
  let userobj = {
    _id: `org.couchdb.user:${username}`,
    name: username,
    password,
    email,
    type: 'user',
    roles: [],
    date: new Date().toISOString(),
  };

  //
  let url = `${config.registries.npm.config.registry}/-/user/org.couchdb.user:${encodeURIComponent(username)}`;
  let res = await requestManager.request({
    url,
    method: 'PUT',
    body: userobj,
    auth: {username, password, email},
    json: true,
  });

  if (res.ok) {
    reporter.success(reporter.lang('loggedIn'));

    let token = res.token;
    config.registries.npm.setToken(token);

    return async function revoke(): Promise<void> {
      reporter.success(reporter.lang('revokedToken'));
      await config.requestManager.request({
        url: `${config.registries.npm.config.registry}/-/user/token/${token}`,
        method: 'DELETE',
      });
    };
  } else {
    throw new MessageError(reporter.lang('incorrectCredentials'));
  }
}

export async function run(
 config: Config,
 reporter: Reporter,
 flags: Object,
 args: Array<string>,
): Promise<void> {
  await getCredentials(config, reporter);
}
