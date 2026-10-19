import js from '@eslint/js'
import react from 'eslint-plugin-react'
import hooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: { globals: globals.browser, parserOptions: { ecmaFeatures: { jsx: true }, ecmaVersion: 'latest', sourceType: 'module' } },
    plugins: { react, 'react-hooks': hooks },
    rules: {
      'react/jsx-uses-vars': 'error', 'react/jsx-no-undef': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'no-unused-vars': ['warn', { varsIgnorePattern: '^_' }],
    },
  },
]
