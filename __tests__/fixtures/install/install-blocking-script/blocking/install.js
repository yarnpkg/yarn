const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'OHAI> ',
});

rl.prompt();

rl
  .on('line', line => {
    switch (line.trim()) {
      case 'hello':
        console.log('world!');
        break;
      default:
        console.log(`Say what? I might have heard '${line.trim()}'`);
        break;
    }
    rl.prompt();
  })
  .on('close', () => {
    console.log('Have a great day!');
    process.exit(0);
  });
