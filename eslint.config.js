import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'android', 'ios', 'gpu_train', 'server/node_modules', 'analysis', 'capacitor.config.ts']),
  // Клиентский код (браузер)
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.browser,
        // define() из vite.config.js — версия, инжектится в бандл
        __APP_VERSION__: 'readonly',
      },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // ---- error (блокирует CI) — реальные runtime-баги ----
      // rules-of-hooks наследуется как error из reactHooks.configs.flat.recommended
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      // NBSP в тексте JSX — это часто осознанный неразрывный пробел, не баг
      'no-irregular-whitespace': ['error', { skipJSXText: true }],
      // ---- warn (отчёт, не блокирует) — стилистика / подсказки ----
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      // allowConstantExport: файл может экспортировать компонент + константы
      // без ломания HMR (Vite/React Fast Refresh это нормально переживает).
      // Закрывает ворнинги в QRCode.jsx, ReplayViewer.jsx, и др. файлах где
      // рядом с компонентом экспортируется хелпер/константа.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  // Серверный код (Node)
  {
    files: ['server/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: { ...globals.node },
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  // Тесты (Node + vitest globals)
  {
    files: ['tests/**/*.{js,jsx}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: { ...globals.node, ...globals.vitest },
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  // Конфиги в корне (Node)
  {
    files: ['*.config.js', '*.config.ts'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: { ...globals.node },
      sourceType: 'module',
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
])
