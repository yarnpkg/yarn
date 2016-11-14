#!/usr/bin/env node
/* eslint-disable */

const createWebpackConfig = require('./create-webpack-config');
const webpack = require('webpack');
const path = require('path');
const util = require('util');

const version = require('../package.json').version;
const basedir = path.join(__dirname, '../');
const babelRc = JSON.parse(fs.readFileSync(path.join(basedir, '.babelrc'), 'utf8'));

const compiler = webpack(createWebpackConfig({
  entry: [path.join(basedir, 'src/cli/index.js')],
  output: {
    filename: `yarn-${version}.js`,
    path: path.join(basedir, 'artifacts')
  }
}));

const compilerLegacy = webpack(createWebpackConfig({
  entry: [path.join(basedir, 'src/cli/index.js')],
  output: {
    filename: `yarn-legacy-${version}.js`,
    path: path.join(basedir, 'artifacts')
  },
  babelQuery: babelRc.env['pre-node5']
}));

compiler.run((err, stats) => {
  const {fileDependencies} = stats.compilation;
  const filenames = fileDependencies.map(x => x.replace(basedir, ''));
  console.log(util.inspect(filenames, {maxArrayLength: null}));
});

compilerLegacy.run((err, stats) => {
  // do nothing, but keep here for debugging...
});
