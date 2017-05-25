if (process.argv.length === 3 && (process.argv[2] === 'mcheck' || process.argv[2] === 'minstall')) {

    var Fs = require('fs');
    var Path = require('path');

    try {

        var cwd = process.cwd();

        while (!Fs.existsSync(cwd + '/package.json')) {

            if (cwd !== '/') {
                cwd = Path.dirname(cwd);
            } else {
                process.exit(0);
            }

        }

        var nodeModules = Fs.lstatSync(cwd + '/node_modules');
        var yarnJson = Fs.lstatSync(cwd + '/yarn.json');

        if (nodeModules.mtime > yarnJson.mtime) {
            process.exit(0);
        }

    } catch (error) {}

    switch (process.argv[2]) {

        case 'mcheck': {
            process.exit(1);
        } break;

        case 'minstall': {
            process.argv = process.argv.slice(0, 2).concat([ 'install' ]);
        } break;

    }

}

if (typeof program !== 'undefined') {
    eval(program);
} else {
    require('./index');
}
