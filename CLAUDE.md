# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Crux (`crux-ui` on npm) — headless, unstyled, accessible UI primitives for Alpine.js, distributed as an Alpine plugin. The current v0.0.1 is a name-claiming placeholder; `src/index.js` is the entire source. Primitives (dialog, combobox, tabs, popover, etc.) are being built here from scratch.

**PLAN.md is the source of truth** for the project's direction; **API.md specifies the primitive API surface** (directive grammar, config attributes, data-state styling contract, events, magics) — follow it when building primitives. Read both before doing substantive work. Key points:

- This package is layer 1 of a three-layer, shadcn-style system: (1) this headless primitives npm package, (2) a static JSON component registry on Vercel with Blade/Antlers template variants, (3) a docs/preview site. Layers 2 and 3 live elsewhere; this repo is only the primitives package.
- Primitives ship as a real npm dependency (not copied into projects) so a11y fixes propagate via version bumps.
- Each primitive must implement correct WAI-ARIA roles/attributes, keyboard navigation, focus trap/restore, and dismiss behavior. Positioning uses Floating UI.
- **Clean-room requirement:** code here must NOT be derived from the author's paid AlpineUI prototype source. Reimplementing a directive API surface is fine; copying implementation is not. Never ask to see or reference that private source.

## Development

There is no build step, test runner, or linter configured yet. The package is plain ESM (`"type": "module"`), entry point `src/index.js`, with `alpinejs ^3.0.0` as a peer dependency. The plugin is registered via `Alpine.plugin(Crux)`.

If you add tooling (tests, bundling, lint), update this file with the commands.

## Workflow

- `/pr` (`.claude/commands/pr.md`) pushes the current branch and opens a PR to `main` with a `## What's new` / `## What's fixed` body.
