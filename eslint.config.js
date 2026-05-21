import js from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2020 },
      globals: { window: true, document: true, navigator: true, console: true, fetch: true, setTimeout: true, clearTimeout: true, setInterval: true, clearInterval: true, URL: true, URLSearchParams: true, localStorage: true, sessionStorage: true, indexedDB: true, IDBKeyRange: true, crypto: true, performance: true, alert: true, confirm: true, prompt: true, location: true, history: true, self: true, caches: true, Response: true, Request: true, Headers: true, FormData: true, Blob: true, File: true, FileReader: true, FileList: true, Event: true, CustomEvent: true, AbortController: true, AbortSignal: true, HTMLInputElement: true, HTMLElement: true, HTMLButtonElement: true, HTMLSelectElement: true, Element: true, EventTarget: true },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
]
