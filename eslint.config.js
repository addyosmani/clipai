import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import css from '@eslint/css';
import globals from 'globals';

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.js'],
    plugins: {
      js,
    },
    extends: ['js/recommended'],
    languageOptions: {
      globals: {
        ...globals.browser,
        chrome: 'readonly',
      }
    }
  },
  {
    files: ['scripts/*.js'],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  },
  {
    files: ['content.js'],
    languageOptions: {
      globals: {
        ...globals.browser
      }
    }
  },
  {
    files: ['*.css'],
    plugins: {
      css,
    },
    language: 'css/css',
    extends: ['css/recommended'],
    rules: {
      "css/use-baseline": "off",
    }
  }
]);
