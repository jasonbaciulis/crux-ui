import js from '@eslint/js'
import globals from 'globals'
import unicorn from 'eslint-plugin-unicorn'
import vitest from '@vitest/eslint-plugin'
import prettier from 'eslint-config-prettier'
import { defineConfig } from 'eslint/config'

export default defineConfig([
  js.configs.recommended,
  unicorn.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      // Correctness beyond recommended
      'array-callback-return': ['error', { checkForEach: true }],
      'no-await-in-loop': 'error',
      'no-constructor-return': 'error',
      'no-promise-executor-return': 'error',
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-unreachable-loop': 'error',
      'no-use-before-define': ['error', { functions: false }],
      'require-atomic-updates': 'error',

      // Alpine evaluates binding objects with `this` bound to the component
      // scope — `this` outside classes is the plugin API, not an accident.
      'unicorn/no-this-outside-of-class': 'off',

      // `null` is fine as a deliberate "empty, filled in later" value;
      // a literal `undefined` property reads like it was never declared.
      'unicorn/no-null': 'off',

      // The rule's own rationale is consistency, not correctness. Looking up a
      // runtime id wants getElementById — exact match, no `#id` escaping — while
      // hardcoded lookups still read better as selectors and stay flagged.
      'unicorn/prefer-query-selector': ['error', { allowWithVariables: true }],

      // Strictness
      'no-unused-vars': [
        'error',
        { args: 'all', argsIgnorePattern: '^_', caughtErrors: 'all', ignoreRestSiblings: true },
      ],
      // console.warn is the library's misuse-warning channel; log/debug stay banned.
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-param-reassign': ['error', { props: false }],
      'no-shadow': 'error',
      'no-throw-literal': 'error',
      'no-implicit-coercion': ['error', { boolean: false }],
      'no-multi-assign': 'error',
      'no-return-assign': ['error', 'always'],
      'no-sequences': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      radix: 'error',
      'default-case-last': 'error',
      'grouped-accessor-pairs': 'error',
      'one-var': ['error', 'never'],

      // Size limits — stop functions growing into shapes where bugs thrive.
      complexity: ['error', 12],
      'max-depth': ['error', 3],
      'max-params': ['error', 4],

      // Modern idioms
      'prefer-const': 'error',
      'prefer-template': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-object-spread': 'error',
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
      'object-shorthand': 'error',
      'no-else-return': ['error', { allowElseIf: false }],
      'no-lonely-if': 'error',
      'no-unneeded-ternary': 'error',
      'no-useless-rename': 'error',
      'no-useless-return': 'error',
      'no-useless-concat': 'error',
      'no-useless-computed-key': 'error',

      // `el`, `attrs`, etc. are Alpine's own API vocabulary, not abbreviations we invented.
      'unicorn/name-replacements': [
        'error',
        {
          allowList: {
            el: true,
            attr: true,
            attrs: true,
            prop: true,
            props: true,
            ref: true,
            refs: true,
            args: true,
          },
        },
      ],
    },
  },
  {
    files: ['tests/**/*.js'],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      'vitest/no-focused-tests': 'error',
      'vitest/no-disabled-tests': 'error',
      // Test helpers legitimately await inside polling/settle loops.
      'no-await-in-loop': 'off',
      // Alpine's bootstrap contract is `window.Alpine = Alpine` before start().
      'unicorn/prefer-global-this': 'off',
      'unicorn/no-global-object-property-assignment': 'off',
      // Assertions deliberately use hasAttribute('data-open') — the styling
      // contract is attribute presence ([data-open] selectors), not dataset.
      'unicorn/dom-node-dataset': 'off',
    },
    languageOptions: {
      globals: { ...globals.node, ...globals.vitest },
    },
  },
  {
    files: ['vitest.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  prettier,
])
