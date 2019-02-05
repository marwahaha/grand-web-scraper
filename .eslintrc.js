// http://eslint.org/docs/user-guide/configuring

module.exports = {
    root: true,
    parser: 'babel-eslint',
    parserOptions: {
        sourceType: 'module'
    },
    env: {
        browser: false,
    },
    extends: 'airbnb-base',
    // add your custom rules here
    rules: {
        'indent': ['error', 4],
        'semi': [2, 'never'],
        'no-plusplus': 0,
        'import/no-extraneous-dependencies': 0,
        'no-underscore-dangle': 0,
        'no-console': ['warn'],
        'linebreak-style': 0,
        'no-await-in-loop': 0,
        'newline-per-chained-call': 0,
        'global-require': 0,
        'no-continue': 0,
    },
    globals: {},
    // settings: {
    //     'import/resolver': {
    //         webpack: 'webpack.config.js',
    //     },
    // },
}
