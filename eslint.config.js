import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist']),
  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    // Keeps the domain and persistence layers framework-free.
    files: ['src/domain/**', 'src/persistence/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { regex: '^(react|react/.*|react-dom|react-dom/.*|@xyflow/react)$', message: 'Domain and persistence code must not depend on the view layer.' },
          ],
        },
      ],
    },
  },
])
