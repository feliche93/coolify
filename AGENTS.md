# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains command entry points. Each command name in `package.json` maps to `src/<command>.{ts,tsx,js,jsx}` (e.g. command `create` → `src/create.tsx`).
- Use `tsx` for commands with UI, `ts` for headless or utility commands.
- `assets/` stores icons and other bundled files referenced at runtime or from `package.json`.
- Root configs: `package.json` (manifest + commands), `tsconfig.json`, `eslint.config.js`, and `CHANGELOG.md`.

## Build, Test, and Development Commands
- `npm run dev`: start development mode with hot-reload and error overlays.
- `npm run build`: validate and build a production bundle.
- `npm run lint`: lint files in `src/`.
- `npm run fix-lint`: auto-fix lint issues.
- `npm run publish`: verify, build, and publish via Raycast tooling.
- Useful: `npx ray help` to list all CLI commands.

## Coding Style & Naming Conventions
- Language: TypeScript with React for UI commands.
- Lint/format: `@raycast/eslint-config` and `prettier`. Run `npm run lint` before committing.
- File names are command-focused and lowercase with dashes (e.g. `src/list-services.tsx`).
- Use `PascalCase` for components, `camelCase` for functions/variables, and explicit types for API responses.

## Testing Guidelines
- No test framework is configured yet.
- If you add tests, document the runner and add a script to `package.json` (e.g. `npm run test`). Keep tests near implementation (e.g. `src/__tests__/`).

## Commit & Pull Request Guidelines
- No established commit convention in history; use concise, imperative messages (e.g. "Add deployment list command").
- PRs should include:
  - A short summary and rationale.
  - Updated screenshots when command UI changes. Raycast expects consistent backgrounds and clear, high-contrast images.
  - Links to related issues if applicable.

## Configuration & Secrets
- Do not hardcode secrets. Use Raycast Preferences/Secrets for credentials.
- Document any new preferences or setup steps in `README.md`.
