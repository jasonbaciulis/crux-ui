# Custom Directives

Register a custom directive with `Alpine.directive(name, handler)`. The name excludes the `x-` prefix — `Alpine.directive('uppercase', ...)` creates `x-uppercase`.

Verified against Alpine.js 3.15.12 source (`node_modules/alpinejs/src/directives.js`).

## Handler Signature

```js
Alpine.directive('[name]', (el, { value, modifiers, expression, original, type }, { Alpine, effect, cleanup, evaluate, evaluateLater }) => {
    // ...
})
```

### Second argument — the parsed directive

Given `x-example:foo.bar="baz"`:

| Property | Value | Meaning |
|---|---|---|
| `type` | `'example'` | Directive name (after the `x-` prefix) |
| `value` | `'foo'` | The part after `:` (or `null` if absent) |
| `modifiers` | `['bar']` | Array of `.`-separated suffixes |
| `expression` | `'baz'` | The attribute value string (unevaluated) |
| `original` | `'x-example:foo.bar'` | Original attribute name (before shorthand transforms) |

### Third argument — element-bound utilities

| Utility | Purpose |
|---|---|
| `Alpine` | The full Alpine global (avoid importing it — keeps plugins bundle-agnostic) |
| `effect(callback)` | Reactive effect **bound to the element** — auto-released when the element or attribute is removed |
| `cleanup(callback)` | Register teardown, runs when the directive's attribute or element is removed from the DOM |
| `evaluate(expression, extras?)` | Synchronously evaluate an expression in the element's scope, returns the result |
| `evaluateLater(expression)` | Compile once, run many times — returns `run(receiverCallback, { scope, params })` |

## The Canonical Reactive Directive

This is exactly how `x-text` is implemented in core:

```js
Alpine.directive('text', (el, { expression }, { effect, evaluateLater }) => {
    let evaluate = evaluateLater(expression)

    effect(() => {
        evaluate(value => {
            el.textContent = value
        })
    })
})
```

Key pattern: `evaluateLater` compiles the expression **once**; `effect` re-runs whenever a reactive dependency read during evaluation changes; the receiver callback gets the result (handles async expressions transparently — never rely on a return value from `evaluateLater`'s runner, always use the receiver callback).

## One-Shot (Non-Reactive) Directives

Skip `effect` when you only need the initial value:

```js
Alpine.directive('uppercase', (el, { expression }, { evaluate }) => {
    el.textContent = String(evaluate(expression)).toUpperCase()
})
```

`evaluate` returns synchronously. For expressions that may be async, prefer `evaluateLater` + receiver callback.

## Cleanup — Always Release Side Effects

Anything you attach outside the element's own subtree (observers, listeners on `window`/`document`/`body`, timers) must be released in `cleanup`. Example — a scroll-lock directive as a plugin:

```js
export default function (Alpine) {
    Alpine.directive('noscroll', (el, { expression }, { evaluateLater, effect, cleanup }) => {
        const getValue = evaluateLater(expression)

        effect(() => {
            getValue(value => {
                document.body.classList.toggle('overflow-hidden', value)
            })
        })

        cleanup(() => {
            document.body.classList.remove('overflow-hidden')
        })
    })
}
```

Effects created via the injected `effect` utility are auto-released — you do NOT need to `cleanup` those. You do need `cleanup` for everything else.

## Modifiers and Value — Official Plugin Example

`@alpinejs/intersect` shows the full parsed-directive surface (value for `enter`/`leave` variants, modifiers with arguments like `.threshold.50`):

```js
Alpine.directive('intersect', Alpine.skipDuringClone((el, { value, expression, modifiers }, { evaluateLater, cleanup }) => {
    let evaluate = evaluateLater(expression)

    let observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting === (value === 'leave')) return

            evaluate()

            modifiers.includes('once') && observer.disconnect()
        })
    }, { threshold: getThreshold(modifiers) })

    observer.observe(el)

    cleanup(() => observer.disconnect())
}))

// Modifier-with-argument pattern: x-intersect.threshold.50 → read the NEXT array item
function getThreshold(modifiers) {
    if (! modifiers.includes('threshold')) return 0
    let threshold = modifiers[modifiers.indexOf('threshold') + 1]
    return Number(`.${threshold}`)
}
```

## Passing Data Into Evaluation Scope

`evaluateLater`'s runner accepts `{ scope, params }`. Use a scope placeholder to write values back (core `x-modelable` pattern):

```js
let setValue = evaluateLater(`${expression} = __placeholder`)
setValue(() => {}, { scope: { __placeholder: newValue } })
```

## Directive Order

Directives on one element run in a fixed order (`ignore, ref, id, data, anchor, bind, init, for, model, modelable, transition, show, if, [custom/DEFAULT], teleport`). Custom directives run in the DEFAULT slot, after core scope-creating directives. To run earlier:

```js
Alpine.directive('lazy', handler).before('show')
```

## Livewire / Clone Safety

Wrap handlers in `Alpine.skipDuringClone(callback)` when the directive has side effects that must not re-fire while Alpine clones a tree (Livewire morphs, `x-teleport` clones). Core wraps `x-init` and `x-effect` this way; `@alpinejs/intersect` does too. There is also `Alpine.onlyDuringClone(callback)` for the inverse.

## DOM Mutations From Directives

Wrap direct DOM writes in `Alpine.mutateDom(() => { ... })` when mutating the element tree, so Alpine's mutation observer ignores your changes instead of re-initializing them (core `x-text` does this around `el.textContent = value`). For simple attribute/class toggles it is optional but harmless.

## Inline Handlers (advanced)

A handler can carry an `inline` function that runs immediately during tree init (before the deferred main handler) — core uses this for `x-ref`. Rarely needed:

```js
let handler = (el, directive, utilities) => { /* deferred */ }
handler.inline = (el, directive, utilities) => { /* immediate */ }
Alpine.directive('thing', handler)
```
