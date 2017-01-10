const configs = {};
for (const key in process.env) {
  if (key.startsWith('npm_config_')) {
    configs[key] = process.env[key];
  }
}
console.log(`##${JSON.stringify(configs)}##`);
