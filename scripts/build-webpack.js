#!/usr/bin/env node
/* eslint-disable */

const webpack = require('webpack');
const path = require('path');
const util = require('util');

const basedir = path.join(__dirname, '../');

const compiler = webpack({
  entry: [path.join(basedir, 'src/cli/index.js')],
  module: {
    loaders: [{
      test: /\.js$/,
      exclude: /node_modules/,
      loader: 'babel',
    }, {
      test: /\.json$/,
      loader: 'json',
    }],
  },
  output: {
    filename: 'index.js',
    path: path.join(basedir, 'lib/cli'),
  },
  target: 'node',
});

compiler.run((err, stats) => {
  const {fileDependencies} = stats.compilation;
  const filenames = fileDependencies.map(x => x.replace(basedir, ''));
  console.log(util.inspect(filenames, {maxArrayLength: null}));
});
