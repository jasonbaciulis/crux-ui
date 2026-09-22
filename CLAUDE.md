# CLAUDE.md

## What this is

Crux UI (`crux-ui` on npm) — headless, unstyled, accessible UI primitives for Alpine.js, the "Base UI for AlpineJS". This repo is the npm package only. The two upper layers of the plan — the shadcn-style component registry (Blade + Antlers) and the docs site (crux-ui.com, Laravel + laradocs) — live in the separate `crux-ui.com` repo; see `plans/PLAN.md` for the roadmap and decision log and `plans/docs-repo-layout.md` for that repo's layout. **`API.md` is the v1 API spec** — directive grammar, config attributes, data-attribute styling contract, events, magics, and the build order for upcoming primitives. Read it before adding or changing any primitive. If you have better suggestions, feel free to push back on it.

## Commands

Bun is the package manager (`bun.lock`, CI uses bun); scripts also work with npm.

- `bun install` — install dependencies
- `bun run test` — run all tests once (vitest, jsdom environment)
- `bun run test:watch` — vitest watch mode
- `bun run build` — build the package (esbuild → `dist/`)
- `bun run lint` / `bun run lint:fix` — ESLint
- `bun run format` / `bun run format:check` — Prettier
- `bunx vitest run tests/collapsible.test.js` — run a single test file
- `bunx vitest run -t "respects default-open"` — run a single test by name

## Architecture

Each primitive is one module in `src/<name>.js` exporting `(Alpine) => void` that registers one directive + one magic. `src/index.js` is the default plugin registering all primitives; per-primitive entries are exposed via package.json `exports` for bundle-conscious users. Shared behavior with no Alpine primitive (roving focus, dismiss layering, focus trap, Floating UI positioning) will live in `src/core/` — everything else must reuse Alpine's own machinery: `x-id`/`$id` for ids, `$dispatch` for events, `$watch` for change tracking, `x-modelable` for `x-model`, `Alpine.bind` for applying bindings, `x-collapse`/`x-transition` for animation (Crux ships no animation of its own).

The uniform grammar every primitive follows (details in API.md):

- One directive per component; parts are the directive argument (`x-accordion`, `x-accordion:trigger`). Part names follow Base UI vocabulary. Root markup always pairs the directive with a bare `x-data` (`<div x-data x-collapsible>`) — Alpine's initial scan visits only `[x-data]`/`[x-init]` elements, so a server-rendered root without it (and without an `x-data` ancestor) silently never initializes (regression-tested in `tests/prerendered-init.test.js`).
- Static config = plain kebab-case attributes on the root (`default-open`, `multiple`), readable by any server templating engine — no Alpine expressions required.
- Dynamic control = `x-model` via `x-modelable`; it overrides `default-*` attrs.
- State out = boolean-presence data-attributes (`data-open` present/absent, never `data-state="…"` values), real ARIA attributes, kebab-case bubbling CustomEvents (`<component>-change` with `detail.value`), and a `$<component>` magic that resolves the nearest root through Alpine's scope chain (not `closest()`).

`src/collapsible.js` is the reference implementation — it proves the whole grammar and is the pattern to copy for new primitives. Internal component state lives in a double-underscore-prefixed `x-data` property (`__collapsible`) so parts reach it via `Alpine.$data(el)`; `console.warn` with a `[Crux UI]` prefix is the misuse-warning channel.

Public contract for semver: directive/part names, config attributes, `data-*` attributes, CSS variables, event names/payloads, magic APIs, model value types. Internal DOM manipulation and core utils are not public API.
