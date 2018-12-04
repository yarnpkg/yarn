'use strict';

const argv = require('yargs').argv;
const plumber = require('gulp-plumber');
const newer = require('gulp-newer');
const babel = require('gulp-babel');
const sourcemaps = require('gulp-sourcemaps');
const log = require('fancy-log');
const gulpif = require('gulp-if');
const gulp = require('gulp');
const path = require('path');
const fs = require('fs');

const babelRc = JSON.parse(fs.readFileSync(path.join(__dirname, '.babelrc'), 'utf8'));

const ver = process.versions.node;
const majorVer = parseInt(ver.split('.')[0], 10);

const build = (lib, opts) =>
  gulp.src('src/**/*.js')
      .pipe(plumber({
        errorHandler(err) {
          log.error(err.stack);
        },
      }))
      .pipe(newer(lib))
      .pipe(gulpif(argv.sourcemaps, sourcemaps.init()))
      .pipe(babel(opts))
      .pipe(gulpif(argv.sourcemaps, sourcemaps.write('.', {sourceRoot: '../src'})))
      .pipe(gulp.dest(lib));

gulp.task('build', () =>
  build('lib', babelRc.env[majorVer >= 5 ? 'node5' : 'pre-node5'])
);

gulp.task('default', gulp.task('build'));

gulp.task(
  'watch',
  gulp.series('build', () => gulp.watch('src/**/*', gulp.task('build')))
);
