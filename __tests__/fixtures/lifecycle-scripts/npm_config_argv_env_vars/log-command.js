try {
  const argv = JSON.parse(process.env['npm_config_argv']);

  for (const arg of argv.cooked) {
    console.log(`##${arg}##`);
  }
} catch (err) {
  console.log(`##${err.toString()}##`);
}
