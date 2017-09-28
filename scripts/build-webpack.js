#!/usr/bin/env node
/* eslint-disable */

const webpack = require('webpack');
const path = require('path');
const util = require('util');
const fs = require('fs');

const version = require('../package.json').version;
const basedir = path.join(__dirname, '../');
const babelRc = JSON.parse(fs.readFileSync(path.join(basedir, '.babelrc'), 'utf8'));

// Use the real node __dirname and __filename in order to get Yarn's source
// files on the user's system. See constants.js
const nodeOptions = {
  __filename: false,
  __dirname: false,
};

//
// Modern build
//

const compiler = webpack({
  // devtool: 'inline-source-map',
  entry: {
    [`artifacts/yarn-${version}.js`]: path.join(basedir, 'src/cli/index.js'),
    'packages/lockfile/index.js': path.join(basedir, 'src/lockfile/index.js'),
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
      },
      { test: /rx\.lite\.aggregates\.js/, use: 'imports-loader?define=>false' },
    ],
  },
  plugins: [
    new webpack.BannerPlugin({
      banner: '#!/usr/bin/env node',
      raw: true,
    }),
  ],
  output: {
    filename: `[name]`,
    path: basedir,
    pathinfo: true,
    libraryTarget: 'commonjs2',
  },
  target: 'node',
  node: nodeOptions,
});

compiler.run((err, stats) => {
  const fileDependencies = stats.compilation.fileDependencies;
  const filenames = fileDependencies.map(x => x.replace(basedir, ''));
  console.log(util.inspect(filenames, {maxArrayLength: null}));
});

//
// Legacy build
//

const compilerLegacy = webpack({
  // devtool: 'inline-source-map',
  entry: path.join(basedir, 'src/cli/index.js'),
  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        query: babelRc.env['pre-node5'],
      },
    ],
  },
  plugins: [
    new webpack.BannerPlugin({
      banner: '#!/usr/bin/env node',
      raw: true,
    }),
  ],
  output: {
    filename: `yarn-legacy-${version}.js`,
    path: path.join(basedir, 'artifacts'),
    libraryTarget: 'commonjs2',
  },
  target: 'node',
  node: nodeOptions,
});

compilerLegacy.run((err, stats) => {
  // do nothing, but keep here for debugging...
});
