const webpack = require('webpack');
const path = require('path');
const fs = require('fs');

module.exports = function createWebpackConfig(opts) {
  return {
    // devtool: 'inline-source-map',
    entry: opts.entry,
    module: {
      loaders: [{
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel',
        query: opts.babelQuery || '',
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
    output: opts.output,
    target: 'node',
  };
};
