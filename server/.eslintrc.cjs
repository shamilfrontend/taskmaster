module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  extends: [
    'airbnb-base',
    'airbnb-typescript/base',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  settings: {
    'import/resolver': {
      typescript: {
        project: './tsconfig.json',
      },
    },
  },
  rules: {
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        js: 'always',
        ts: 'never',
      },
    ],
    'import/prefer-default-export': 'off',
    'no-console': 'off',
    'no-void': ['error', { allowAsStatement: true }],
    'no-underscore-dangle': [
      'error',
      {
        allow: ['_id'],
      },
    ],
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/no-use-before-define': [
      'error',
      { functions: false },
    ],
    'no-restricted-syntax': [
      'error',
      {
        selector: 'ForInStatement',
        message:
          'for..in loops iterate over the entire prototype chain. Use Object.{keys,values,entries}.',
      },
      {
        selector: 'LabeledStatement',
        message: 'Labels are a form of GOTO; using them makes code confusing.',
      },
      {
        selector: 'WithStatement',
        message: '`with` is disallowed in strict mode.',
      },
    ],
  },
};
