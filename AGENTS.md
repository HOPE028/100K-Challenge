# Repository Guidelines

## Project Structure & Module Organization

This is a Vite React 19 + TypeScript single-page app for the 100,000 lb challenge. Source lives in `src/`:

- `src/App.tsx` contains the main UI, form handling, derived dashboard state, and Firebase/demo-mode branching.
- `src/lib/workout.ts` contains pure workout helpers for parsing entries, calculating load, formatting, and progress series.
- `src/types.ts` defines shared domain types such as `WorkoutEntry`, `LiftType`, and form state.
- `src/firebase.ts` initializes Firebase and exports the Firestore instance.
- `src/index.css` holds global styles; `src/main.tsx` mounts the React app.

Build output goes to `dist/`. Avoid editing generated files such as `dist/` or `*.tsbuildinfo`.

## Build, Test, and Development Commands

- `npm install` installs dependencies from `package-lock.json`.
- `npm run dev` starts the Vite development server with hot reload.
- `npm run build` runs `tsc -b` and then creates the production Vite build.
- `npm run preview` serves the built app locally for production checks.

No `test` or `lint` script is currently configured. Use `npm run build` as the baseline verification command before submitting changes.

## Coding Style & Naming Conventions

Use TypeScript with `strict` mode enabled. Prefer explicit domain types from `src/types.ts` instead of duplicating shapes inline. Keep business logic that can be tested independently in `src/lib/workout.ts`, and keep React-specific state and effects in `src/App.tsx`.

Follow the existing style: two-space indentation, double quotes, semicolons, `camelCase` for variables/functions, `PascalCase` for React components and exported types, and `UPPER_SNAKE_CASE` for constants such as challenge targets.

## Testing Guidelines

There is no test framework configured yet. When adding tests, place them near the code they cover with names like `workout.test.ts` or `App.test.tsx`, then add an `npm test` script. Prioritize pure helper coverage for `parseQuickEntry`, `calculateLoadMoved`, progress calculations, and Firestore/demo-mode edge cases.

## Commit & Pull Request Guidelines

Recent commits use short imperative summaries, for example `Improved metadata` and `Add delete entries, fix Firebase error handling, and polish UI`. Keep commit subjects concise and focused on the user-visible or technical outcome.

Pull requests should include a clear summary, verification steps such as `npm run build`, screenshots for UI changes, and notes about Firebase configuration or Firestore data-shape changes. Link related issues when available.

## Security & Configuration Tips

Firebase credentials should be provided through local environment variables and should not be committed. The app supports a local/demo mode when Firebase config is absent, so preserve that fallback when changing initialization or data flow.
