# Technology Stack

## Languages & Runtime

- TypeScript (strict), pinned to `~6.0` because typescript-eslint does not yet support 7.
- ES modules, browser runtime (single-page, local-first, no backend). Node is needed only for tooling.

## Frameworks & Libraries

- React 19 as a thin view layer.
- `@xyflow/react` 13 renders one diagram Level at a time.
- IDs come from `crypto.randomUUID()`.

## Build & Tooling

- Vite 8 with `@vitejs/plugin-react`; `tsc -b` type-checks before the build.
- Vitest 4 and fast-check 4 for tests (`src/**/*.test.ts`, `src/**/*.property.test.ts`).
- ESLint 10 with typescript-eslint and `eslint-plugin-react-hooks`. `src/domain` and `src/persistence` may not import `react` or `@xyflow/react`.

## Common Commands

```bash
# build: npm run build
# test: npm test
# lint: npm run lint
# run: npm run dev
```
