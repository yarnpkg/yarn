#!/usr/bin/env node

const createWebpackConfig = require('./create-webpack-config');
const webpack = require('webpack');
const cpFile = require('cp-file');
const path = require('path');
const os = require('os');

const basedir = path.join(__dirname, '../');
const config = createWebpackConfig({
  entry: [path.join(basedir, 'bin/test.js')],
  output: {
    filename: `yarn-${Date.now()}.js`,
    path: os.tmpdir()
  }
});
config.bail = true;
console.log(config);
const compiler = webpack(config);

console.log(path.join(basedir, 'bin/yarn.js'));

compiler.run((err, stats) => {
  const {fileDependencies} = stats.compilation;

  console.log(fileDependencies);

  Promise.all(fileDependencies.map(src => {
    if (src.indexOf('node_modules') < 0) return;
    return cpFile(src, path.join(basedir, 'dist', src.replace(basedir, '')))
  })).catch(err => {
    console.error(err);
    process.exit(1);
  });
});
