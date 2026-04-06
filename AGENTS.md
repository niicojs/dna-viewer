# AGENTS.md

## Tooling

- This repo uses `vite-plus` (`vp`) as the real toolchain, configured in `vite.config.ts`. Prefer `pnpm exec vp ...` over guessing `eslint`, `prettier`, or raw `vitest` commands.
- Use `pnpm` (`packageManager` is `pnpm@10.33.0`).
- Useful verified commands:
  - `pnpm dev` starts the TanStack Start dev server on port `3000`.
  - `pnpm build` builds the client, SSR bundle, and Nitro server into `.output/`.
  - `pnpm preview` previews the production build.
  - `vp lint <path>` runs lint + type-aware analysis on a focused file.
  - `vp fmt <path> --check` checks formatting for a focused file.
  - `vp check --no-fmt <path>` is the focused lint/typecheck shortcut when you do not need a format pass.

## Codebase Map

- This is a single-package TanStack Start app, not a monorepo.
- Main app flow:
  - `src/routes/__root.tsx`: document shell, global CSS include, theme boot script, devtools.
  - `src/routes/index.tsx`: main XDNA Viewer UI and file-loading flow.
  - `src/router.tsx`: router creation.
  - `src/routeTree.gen.ts`: generated TanStack Router tree.
- XDNA parsing and viewer wiring:
  - `src/lib/xdna-parser.ts`: core parser and shared types.
  - `src/lib/xdna-to-seqviz.ts`: converts parsed XDNA data into SeqViz props.
  - `src/components/seqviz-viewer.tsx`: SeqViz wrapper.
  - `src/components/feature-list.tsx`: sidebar feature list/details.
- Import aliases `#/*` and `@/*` both resolve to `src/*`.

## Generated And Fragile Files

- Do not edit `src/routeTree.gen.ts`; TanStack Router regenerates it and the file header explicitly marks it generated.
- `.tanstack/` and `.output/` are generated directories.

## Naming

- Use `snake_case` for both local variable names and filenames.
- Use `PascalCase` for React component names.
- Use `camelCase` for functions
