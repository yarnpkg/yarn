module.exports = {
    transform: { [`^.+\\.js$`]: require.resolve('babel-jest') },
    resolver: './scripts/jest-resolver',
};
