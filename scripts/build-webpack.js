#!/usr/bin/env node
/* eslint-disable */

const webpack = require('webpack');
const path = require('path');
const util = require('util');
const fs = require('fs');

const version = require('../package.json').version;
const basedir = path.join(__dirname, '../');
const babelRc = JSON.parse(fs.readFileSync(path.join(basedir, '.babelrc'), 'utf8'));

//
// Modern build
//

const compiler = webpack({
  // devtool: 'inline-source-map',
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
  plugins: [
    new webpack.BannerPlugin({
      banner: "#!/usr/bin/env node",
      raw: true
    })
  ],
  output: {
    filename: `yarn-${version}.js`,
    path: path.join(basedir, 'artifacts'),
  },
  target: 'node',
});

compiler.run((err, stats) => {
  const {fileDependencies} = stats.compilation;
  const filenames = fileDependencies.map(x => x.replace(basedir, ''));
  console.log(util.inspect(filenames, {maxArrayLength: null}));
});

//
// Legacy build
//

const compilerLegacy = webpack({
  // devtool: 'inline-source-map',
  entry: [path.join(basedir, 'src/cli/index.js')],
  module: {
    loaders: [{
      test: /\.js$/,
      exclude: /node_modules/,
      loader: 'babel',
      query: babelRc.env['pre-node5'],
    }, {
      test: /\.json$/,
      loader: 'json',
    }],
  },
  plugins: [
    new webpack.BannerPlugin({
      banner: "#!/usr/bin/env node",
      raw: true
    })
  ],
  output: {
    filename: `yarn-legacy-${version}.js`,
    path: path.join(basedir, 'artifacts'),
  },
  target: 'node',
});

compilerLegacy.run((err, stats) => {
  // do nothing, but keep here for debugging...
});
