'use strict';

let fs = require('./lib/util/fs.js');
let fs2 = require('fs');
let minimatch = require('minimatch');

let patterns = [
  '__tests__',
  'test',
  'tests',
  'powered-test',

  'docs',
  'doc',
  'website',
  'images',
  'assets',

  'example',
  'examples',

  'coverage',
  '.nyc_output',

  'Makefile',

  'Gulpfile.js',
  'Gruntfile.js',

  '.tern-project',
  '.gitattributes',
  '.editorconfig',
  '.*ignore',
  '.eslintrc',
  '.jshintrc',
  '.flowconfig',
  '.documentup.json',
  '.kpm-metadata.json',

  '*.min.js',
  '*-min.js',

  '.*.yml',
  '*.yml',
  '*.png',
  '*.jpg',
  '*.jpeg',
  '*.gif',
  '*.txt',
  '*.gz',
  '*.md',
  'CHANGES',
  //'!README.md',

  // unsure? what if people use these
  'build',
  'dist',
  'min',
];

fs.walk('../react-native/node_modules').then(function(files) {
  let removed = [];

  for (let file of files) {
    for (let pattern of patterns) {
      if (minimatch(file.relative, pattern) || minimatch(file.relative, `**/${pattern}`) || minimatch(file.relative, `**/${pattern}/**`)) {
        removed.push(file.absolute);
        break;
      }
    }
  }

  console.log("total files " + files.length);

  let total = 0;
  for (let file of removed) {
    total += fs2.statSync(file).size;
  }
  console.log((total / 1024 / 1024) + "MB freeable");
  console.log(removed.length + " purgable files");
}, console.error);
