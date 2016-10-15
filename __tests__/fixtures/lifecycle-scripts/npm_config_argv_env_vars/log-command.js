try {
  const argv = JSON.parse(process.env['npm_config_argv']);

  console.log(`##${argv.cooked[0]}##`);
} catch (err) {
  console.log(`##${err.toString()}##`);
}
