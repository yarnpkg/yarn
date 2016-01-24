"use strict";

let plumber = require("gulp-plumber");
let through = require("through2");
let chalk   = require("chalk");
let newer   = require("gulp-newer");
let babel   = require("gulp-babel");
let watch   = require("gulp-watch");
let gutil   = require("gulp-util");
let gulp    = require("gulp");
let path    = require("path");

function build(lib, opts) {
  return gulp.src("src/**/*.js")
    .pipe(plumber({
      errorHandler: function (err) {
        gutil.log(err.stack);
      }
    }))
    .pipe(through.obj(function (file, enc, callback) {
      file._path = file.path;
      file.path = file.path.replace("src", lib);
      callback(null, file);
    }))
    .pipe(newer("lib"))
    .pipe(through.obj(function (file, enc, callback) {
      gutil.log("Compiling", "'" + chalk.cyan(file._path) + "' to '" + chalk.cyan(file.path) + "'...");
      callback(null, file);
    }))
    .pipe(babel(opts))
    .pipe(gulp.dest("lib"));
}

gulp.task("default", ["build"]);

gulp.task("build", ["build-modern", "build-legacy"]);

gulp.task("build-modern", function () {
  return build("lib", {
    presets: ["node5", "react", "stage-0"]
  });
});

gulp.task("build-legacy", function () {
  return build("lib-legacy", {
    // TODO find a way to put this in .babelrc
    presets: ["react", "es2015", "stage-0"],
    plugins: [
      ["transform-runtime", { polyfill: true, regenerator: false }]
    ]
  });
});

gulp.task("watch", ["build"], function (callback) {
  watch("src/**/*.js", function () {
    gulp.start("build");
  });
});
