'use strict';

const plumber = require('gulp-plumber');
const newer = require('gulp-newer');
const babel = require('gulp-babel');
const watch = require('gulp-watch');
const gutil = require('gulp-util');
const gulp = require('gulp');
const path = require('path');
const fs = require('fs');

const babelRc = JSON.parse(fs.readFileSync(path.join(__dirname, '.babelrc'), 'utf8'));

function build(lib, opts) {
  return gulp.src('src/**/*')
    .pipe(plumber({
      errorHandler(err) {
        gutil.log(err.stack);
      },
    }))
    .pipe(newer(lib))
    .pipe(babel(opts))
    .pipe(gulp.dest(lib));
}

gulp.task('default', ['build']);

gulp.task('build', ['build-modern', 'build-legacy']);

gulp.task('build-modern', () => {
  return build('lib', babelRc.env.node5);
});

gulp.task('build-legacy', () => {
  return build('lib-legacy', babelRc.env['pre-node5']);
});

gulp.task('watch', ['build'], () => {
  watch('src/**/*', () => {
    gulp.start('build');
  });
});
