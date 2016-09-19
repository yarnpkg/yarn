"use strict";

var plumber = require("gulp-plumber");
var stream  = require("stream");
var chalk   = require("chalk");
var newer   = require("gulp-newer");
var babel   = require("gulp-babel");
var watch   = require("gulp-watch");
var gutil   = require("gulp-util");
var gulp    = require("gulp");
var path    = require("path");
var fs      = require("fs");

var babelRc = JSON.parse(fs.readFileSync(path.join(__dirname, ".babelrc"), "utf8"));

function build(lib, opts) {
  return gulp.src("src/**/*")
    .pipe(plumber({
      errorHandler: function (err) {
        gutil.log(err.stack);
      }
    }))
    .pipe(newer(lib))
    .pipe(new stream.PassThrough({objectMode: true}).on('data', function (file) {
      const dest = path.join(file.cwd, lib, file.relative);
      gutil.log("Compiling", "'" + chalk.cyan(file.path) + "' to '" + chalk.cyan(dest) + "'...");
    }))
    .pipe(babel(opts))
    .pipe(gulp.dest(lib));
}

gulp.task("default", ["build"]);

gulp.task("build", ["build-modern", "build-legacy"]);

gulp.task("build-modern", function () {
  return build("lib", babelRc.env.node5);
});

gulp.task("build-legacy", function () {
  return build("lib-legacy", babelRc.env["pre-node5"]);
});

gulp.task("watch", ["build"], function () {
  watch("src/**/*", function () {
    gulp.start("build");
  });
});
