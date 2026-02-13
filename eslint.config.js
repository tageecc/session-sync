import eslint from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'

export default [
  eslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        // Browser APIs
        chrome: 'readonly',
        document: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        navigator: 'readonly',
        URL: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
        // Web Crypto
        crypto: 'readonly',
        CryptoKey: 'readonly',
        BufferSource: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        // DOM types & browser globals
        HTMLElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLInputElement: 'readonly',
        ParentNode: 'readonly',
        Storage: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        window: 'readonly',
        confirm: 'readonly',
        requestAnimationFrame: 'readonly',
        Uint8Array: 'readonly',
        Set: 'readonly',
        Promise: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
]

