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

export async function getCredentials(config: Config, reporter: Reporter): Promise<{
  username: string,
  email: string,
}> {
  let kpmConfig = config.registries.kpm.config;

  let username = kpmConfig.username;
  if (username) {
    reporter.info(`npm username: ${username}`);
  } else {
    username = await reporter.question('npm username');
  }

  let email = kpmConfig.email;
  if (email) {
    reporter.info(`npm email: ${email}`);
  } else {
    email = await reporter.question('npm email');
  }

  await config.registries.kpm.saveHomeConfig({username, email});

  return {username, email};
}

export async function getToken(config: Config, reporter: Reporter): Promise<{
  token: string,
  revoke: () => Promise<void>
}> {
  let env = process.env.KPM_AUTH_TOKEN || process.env.NPM_AUTH_TOKEN;
  if (env) {
    return {
      token: env,
      async revoke() {
        reporter.info('Not revoking login token, specified via environment variable');
      },
    };
  }

  let requestManager = config.requestManager;

  //
  let {username, email} = await getCredentials(config, reporter);
  let password = await reporter.question('npm password', true);

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
    reporter.success(`Logged in`);
    let token = res.token;
    return {
      token,
      async revoke(): Promise<void> {
        reporter.success('Revoked login token');
        await config.requestManager.request({
          url: `${config.registries.npm.config.registry}/-/user/token/${token}`,
          method: 'DELETE',
        });
      },
    };
  } else {
    throw new MessageError('Incorrect username or password');
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
