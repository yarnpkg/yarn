import Fs       from 'fs';
import toMemory from 'webpack-to-memory';
import webpack  from 'webpack';

toMemory(webpack({

    context: `${__dirname}/sources`,

    entry: {
        yarn: `./index`,
    },

    output: {
        path: `/`,
        filename: `[name]`,
        libraryTarget: `commonjs2`,
    },

    target: `node`,

    module: {
        rules: [ {
            test: /\.js$/,
            exclude: [ /node_modules/ ],
            loader: `babel-loader`,
        } ]
    },

    plugins: [
        new (require(`webpack`).DefinePlugin)({ IS_WEBPACK: true }),
    ]

}), { source: true }).then(fs => {

    let shebang = `#!/usr/bin/env node`;
    let mfast = Fs.readFileSync(`${__dirname}/sources/mfast.js`, `utf8`);

    let program = shebang + `\n\nvar program = ${JSON.stringify(fs.yarn)};\n\n${mfast}\n`;

    Fs.writeFileSync(`${__dirname}/dist/yarn`, program);
    Fs.chmodSync(`${__dirname}/dist/yarn`, 0o755);

});
