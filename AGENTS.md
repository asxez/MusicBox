# Repository Guidelines

## Project Structure & Module Organization
`src/main/` contains the Electron main process in TypeScript, organized around `controllers/`, `services/`, `core/`, and `utils/`. `src/renderer/` contains the Vite renderer; most UI code lives in `src/renderer/src/js/`, with styles in `src/renderer/src/styles/` and assets in `src/renderer/src/assets/`. `native/` is the Rust N-API audio engine. `scripts/` holds build helpers, `docs/` stores documentation, `build/` contains packaging assets, and `test-files/` is used for local media fixtures.

## Build, Test, and Development Commands
- `npm install && npm run install:renderer && npm run install:rs`: install root, renderer, and native dependencies.
- `pip install -r requirements.txt`: install Python tooling used by `src/main/metadata_editor.py`.
- `npm run dev`: build renderer, Rust, and main-process code, then launch Electron.
- `npm run dev:renderer`: run the renderer only with Vite for UI work.
- `npm run build`: produce the full packaged app.
- `npm run build:rs` and `npm run build:python`: rebuild only the native audio module or Python helper.
- `cd src/renderer && npm run lint`: lint renderer JavaScript.

## Coding Style & Naming Conventions
Follow the style already present in each area instead of reformatting unrelated files. Main-process TypeScript uses 4-space indentation, semicolons, `PascalCase` classes such as `AppController.ts`, and `camelCase` methods. Renderer components are also `PascalCase`, while shared helpers stay `camelCase`. Keep import aliases such as `@components`, `@services`, and `@utils` intact. Use concise log messages and keep the emoji-prefixed logging convention.

## Testing Guidelines
There is no single automated test suite at the root today. For UI or playback changes, run `npm run dev` and smoke-test library scan, playback, lyrics, settings, and plugin loading. Put reusable media fixtures in `test-files/`. If you add renderer code, run `cd src/renderer && npm run lint` before opening a PR. Include manual verification steps when automated coverage is not practical.

## Commit & Pull Request Guidelines
Recent history uses lowercase prefixes such as `feature:`, `refactor:`, and `docs:`. Keep commit subjects short, imperative, and scoped to one change. PRs should explain user-visible impact, list commands or manual checks performed, link related issues, and include screenshots for renderer or desktop UI changes. Call out changes in `native/`, packaging, or preload/API boundaries explicitly because they affect release builds and security review.

## Security & Integration Notes
Do not bypass the preload boundary with direct renderer access to Node APIs. Reuse existing main-process utilities such as `src/main/utils/pathSecurity.ts` for filesystem-facing work, and keep native or Python changes isolated to their build paths.
