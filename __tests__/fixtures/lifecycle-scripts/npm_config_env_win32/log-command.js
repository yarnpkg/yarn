const execSync = require('child_process').execSync;

console.log(execSync('cmd /c set NPM_CONFIG').toString());
