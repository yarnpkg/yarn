const HtmlWebpackPlugin = require(`html-webpack-plugin`);
const PnpWebpackPlugin = require(`./scripts/webpack-resolver`);

module.exports = {

    mode: `production`,

    entry: {
        [`app`]: `./sources/index.js`,
    },

    output: {
        filename: `[name].js`,
    },

    module: {
        rules: [{
            test: /\.js$/,
            exclude: /node_modules/,
            loader: require.resolve('babel-loader'),
            options: {},
        }]
    },

    resolve: {
        plugins: [
            PnpWebpackPlugin,
        ]
    },

    resolveLoader: {
        plugins: [
            PnpWebpackPlugin,
        ]
    },

    plugins: [
        new HtmlWebpackPlugin()
    ]

};
