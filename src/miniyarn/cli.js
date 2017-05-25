import {concierge} from '@manaflair/concierge';
import Joi from 'joi';

concierge
  .topLevel(`[-d,--dir PATH] [-s,--silent] [--no-progress] [--offline]`)
  .validate(`dir`, Joi.string().default(process.cwd()));

typeof IS_WEBPACK === `undefined` && concierge.directory(`${__dirname}/commands`, true, /\.js$/);

typeof IS_WEBPACK !== `undefined` && concierge.directory(require.context(`./commands`, true, /\.js$/));

export let cli = concierge;
