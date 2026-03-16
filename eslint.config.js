import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
let __dirname = dirname(__filename);
// Normalize WSL UNC paths for ESLint parser compatibility
if (__dirname.startsWith('\\\\wsl.localhost\\') || __dirname.startsWith('\\\\wsl$\\')) {
  const match = __dirname.match(/\\\\wsl(?:\$|\.localhost)\\[^\\]+(.+)/);
  if (match) {
    __dirname = match[1].replace(/\\/g, '/');
  }
}

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
      globals: {
        Request: 'readonly',
        Response: 'readonly',
        Buffer: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-unused-vars': 'off',
      'no-undef': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  {
    ignores: ['dist', 'build', 'node_modules', '.turbo', '**/*.config.ts', '**/*.config.js'],
  },
];
