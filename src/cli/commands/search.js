/* @flow */

import algoliasearch from 'algoliasearch';
import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {MessageError} from '../../errors.js';
const pkg = algoliasearch('OFCNCOG2CU', 'd72d98ea78084e9825f39d94816506ce').initIndex('npm-search');

export async function run(
 config: Config,
 reporter: Reporter,
 flags: Object,
 args: Array<string>,
): Promise<void> {
  const query = args.join(' ').trim();
  if (query === '') {
    throw new MessageError(config.reporter.lang('searchNeedsQuery'));
  }

  const results = await pkg.search({query, hitsPerPage: 5});

  if (results.hits.length === 0) {
    return reporter.info(config.reporter.lang('searchEmpty', query));
  }

  reporter.info(config.reporter.lang('searchStats', results.nbHits.toLocaleString(), query));

  return reporter.log(results.hits.map((hit) => `${hit.name} \n`).join(''));
}
