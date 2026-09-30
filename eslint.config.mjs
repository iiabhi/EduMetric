import js from '@eslint/js';
import globals from 'globals';
import security from 'eslint-plugin-security';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/generated/**',
      'docs/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  security.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.config.mjs', '*.config.ts', 'apps/api/*.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    // Test files only. Tests such as apps/api/src/architecture.test.ts read the project's own
    // source files to check layering rules, so their fs paths are built at run time. The rule
    // guards application code against attacker-controlled paths, which tests do not take as
    // input. It stays on for all non-test code.
    files: ['**/*.test.ts'],
    rules: { 'security/detect-non-literal-fs-filename': 'off' },
  },
  {
    files: ['**/*.mjs', '**/*.config.ts'],
    ...tseslint.configs.disableTypeChecked,
  },
);
