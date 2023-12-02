#!/usr/bin/env node
/* eslint-disable */

const webpack = require('webpack');
const path = require('path');
const resolve = require('resolve');
const util = require('util');
const fs = require('fs');

// Otherwise Webpack 4 will be "helpful" and automatically mark the `punycode` package as external,
// despite us wanting to bundle it since it will be removed from future Node.js versions.
const binding = process.binding;
process.binding = name => {
  let ret = binding(name);

  if (name === `natives`) {
    delete ret.punycode;
  }

  return ret;
};

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
  resolve: {
    alias: {
      punycode: require.resolve(`punycode/`),
    },
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules|Caches/,
        loader: require.resolve('babel-loader')
      },
      {
        test: /rx\.lite\.aggregates\.js/,
        use: 'imports-loader?define=>false'
      },
      {
        test: /hash-for-dep\/lib\/pkg.js/,
        loader: 'string-replace-loader',
        options: {
          search: 'require[(]([^\'"])',
          replace: '__non_webpack_require__($1',
          flags: 'g'
        }
      }
    ],
  },
  plugins: [
    new webpack.BannerPlugin({
      banner: '#!/usr/bin/env node',
      raw: true,
      exclude: /lockfile/
    }),
  ],
  output: {
    filename: `[name]`,
    path: basedir,
    libraryTarget: 'commonjs2',
  },
  target: 'node',
  node: nodeOptions,
});

compiler.run((err, stats) => {
  const fileDependencies = stats.compilation.fileDependencies;
  const filenames = fileDependencies.map(x => x.replace(basedir, ''));
  //console.log(util.inspect(filenames, {maxArrayLength: null}));
});

//
// Legacy build
//

const compilerLegacy = webpack({
  // devtool: 'inline-source-map',
  entry: path.join(basedir, 'src/cli/index.js'),
  resolve: {
    alias: {
      punycode: require.resolve(`punycode/`),
    },
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules[\\\/](?!inquirer)/,
        use: [
          {
            loader:'babel-loader',
            options: babelRc.env['pre-node5'],
          }
        ],
      },
      {
        test: /rx\.lite\.aggregates\.js/,
        use: 'imports-loader?define=>false'
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
