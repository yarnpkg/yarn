# yarn-lockfile
parse and/or write `yarn.lock` files

## Usage Example

```js
const fs = require('fs');
const lockfile = require('@yarnpkg/lockfile');

let file = fs.readFileSync('yarn.lock', 'utf8');
let json = lockfile.parse(file);

console.log(json);

let fileAgain = lockfile.stringify(json);

console.log(fileAgain);
```
