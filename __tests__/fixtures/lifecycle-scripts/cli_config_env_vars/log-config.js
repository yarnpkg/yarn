// As this file won't be transpiled, we use ES5 here.
var configs = {};
for (var key in process.env) {
  if (key.indexOf('npm_config_') === 0) {
    console.log(key + ':' + process.env[key]);
  }
}
