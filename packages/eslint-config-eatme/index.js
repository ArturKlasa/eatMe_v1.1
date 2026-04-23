import { noUnwrappedAction } from './rules/no-unwrapped-action.js';

const plugin = {
  rules: {
    'no-unwrapped-action': noUnwrappedAction,
  },
};

/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    plugins: { eatme: plugin },
    files: ['**/app/**/actions/*.ts', '**/app/**/route.ts'],
    rules: {
      'eatme/no-unwrapped-action': 'error',
    },
  },
];

export default config;
