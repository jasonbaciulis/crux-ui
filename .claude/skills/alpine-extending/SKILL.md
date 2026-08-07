---
name: alpine-extending
description: "Extends Alpine.js with custom directives, custom magics, plugins, Alpine.data components, stores, and reactivity primitives. Activates when creating or modifying custom Alpine directives (Alpine.directive), magic properties (Alpine.magic), Alpine plugins, reusable Alpine.data components, global stores (Alpine.store), reusable bindings (Alpine.bind), or when using Alpine.reactive/effect/watch/entangle/interceptor APIs; or when the user mentions extending Alpine, custom directive, custom magic, Alpine plugin, x-modelable, $dispatch events, or component APIs."
---

# Extending Alpine.js

Reference for Alpine.js 3.x extension APIs, verified against the installed `alpinejs@3.15.12` source and the official docs (alpinejs.dev).

## When to Apply

- Writing or modifying a custom directive (`Alpine.directive`) or magic (`Alpine.magic`)
- Authoring an Alpine plugin (project-local or distributable)
- Registering reusable components (`Alpine.data`), global state (`Alpine.store`), or binding objects (`Alpine.bind`)
- Using reactivity primitives (`Alpine.reactive`, `Alpine.effect`, `Alpine.watch`, `Alpine.entangle`) outside templates
- Designing a reusable component's public API (`x-modelable`, `$dispatch` events, `$id`/`x-id`, `x-teleport`)

## Reference Rules

| Topic | File |
|---|---|
| Custom directives — handler signature, evaluateLater/effect/cleanup, modifiers, `.before()` ordering, clone safety | `rules/custom-directives.md` |
| Custom magics — property vs function magics, element-bound utilities, interceptor (`$persist`) pattern | `rules/custom-magics.md` |
| Plugins — registration timing, plugin shape, distribution, CSP caveats | `rules/plugins.md` |
| `Alpine.data` / `Alpine.store` / `Alpine.bind`, lifecycle hooks, reactivity primitives, utility APIs | `rules/data-stores-reactivity.md` |
| Component API patterns — x-modelable, $dispatch, x-id/$id, x-teleport, timing gotchas | `rules/component-api-patterns.md` |

Read the relevant doc(s) before writing extension code. For building UI widgets with the headless plugin (`x-dialog`, `x-menu`, …), use the `alpine-ui` skill instead.

## Core Rules

1. **Register before `Alpine.start()`** (bundle) or inside `alpine:init` (script tag) — never after initialization.
2. **Reactive directives** = `evaluateLater(expression)` compiled once + the injected `effect()` re-running the receiver callback. Never rely on return values from the runner; always use the receiver callback (handles async).
3. **Use the injected utilities**, not globals: the element-bound `effect` auto-releases on element removal; bare `Alpine.effect` does not.
4. **`cleanup()` everything external** — listeners on `window`/`document`/`body`, observers, timers. Effects from the injected `effect` are exempt.
5. **Directive names omit `x-`**, magic names omit `$`, both in registration and in `.before('name')`.
6. **Wrap side-effectful handlers in `Alpine.skipDuringClone`** when they must not re-fire during Livewire morphs or teleport clones.
7. Alpine source for any deeper question: `node_modules/alpinejs/src/` (directives.js, magics.js, `directives/x-*.js` and `magics/$*.js` are canonical examples); official plugins in `node_modules/@alpinejs/*/dist/module.esm.js`.
