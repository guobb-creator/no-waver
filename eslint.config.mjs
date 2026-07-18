import { globalIgnores } from 'eslint/config';
import tsParser from '@typescript-eslint/parser';

export default [
  globalIgnores(['.next/**', 'node_modules/**', 'playwright-report/**', 'test-results/**']),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  },
];
