export default concierge =>
  concierge.command(`help`).describe(`Print this help message; use --help for commands help`).action(async args => {
    concierge.usage();
  });
