# Custom Magics

Register a custom magic with `Alpine.magic(name, callback)`. The name excludes the `$` prefix — `Alpine.magic('now', ...)` creates `$now`.

Verified against Alpine.js 3.15.12 source (`node_modules/alpinejs/src/magics.js`).

## How Magics Work

Magics are injected as **getters** on every evaluation scope. Your callback runs each time the magic is *accessed* in an expression, and receives the element the expression belongs to plus element-bound utilities:

```js
Alpine.magic('[name]', (el, { Alpine, effect, cleanup, evaluate, evaluateLater, interceptor }) => {
    // return the value $name resolves to
})
```

| Utility | Purpose |
|---|---|
| `Alpine` | The full Alpine global |
| `effect(callback)` | Element-bound reactive effect, auto-released when the element is removed |
| `cleanup(callback)` | Teardown when the element is removed from the DOM |
| `evaluate` / `evaluateLater` | Evaluate expressions in the element's scope (same as directives) |
| `interceptor` | Build data-aware magics that hook into `x-data` initialization (see below) |

## Magic Properties

Return a value — accessed as `$now`:

```js
Alpine.magic('now', () => {
    return (new Date).toLocaleTimeString()
})
```

```html
<span x-text="$now"></span>
```

Note: the returned value is NOT reactive by itself. The getter re-runs only when a reactive dependency in the surrounding expression changes.

## Magic Functions

Return a function — accessed as `$clipboard(...)`:

```js
Alpine.magic('clipboard', () => subject => {
    navigator.clipboard.writeText(subject)
})
```

```html
<button @click="$clipboard('hello world')">Copy</button>
```

## Magics That Use the Element's Scope

Core `$watch` shows the full utility surface — compile the key as an expression against the element's scope, and release the watcher on element removal:

```js
Alpine.magic('watch', (el, { evaluateLater, cleanup }) => (key, callback) => {
    let evaluate = evaluateLater(key)

    let getter = () => {
        let value
        evaluate(resolvedValue => value = resolvedValue)
        return value
    }

    let unwatch = Alpine.watch(getter, callback)

    cleanup(unwatch)
})
```

Core `$dispatch` shows the minimal element-bound form:

```js
Alpine.magic('dispatch', el => (name, detail = {}) => {
    el.dispatchEvent(new CustomEvent(name, {
        detail,
        bubbles: true,
        composed: true,   // crosses shadow DOM boundaries
        cancelable: true,
    }))
})
```

## Interceptor Magics (the `$persist` pattern)

An interceptor magic returns a marker object from the magic getter; Alpine detects it during `x-data` initialization and replaces the property with whatever your callback returns. Use it when a magic must wrap an `x-data` **property** (`{ count: $persist(0) }`) rather than just compute a value.

`interceptor(callback, mutateObj?)`:
- `callback(initialValue, getter, setter, path, key)` — runs at data-init time; whatever it returns becomes the property's value
- `mutateObj(func)` — optionally attach chainable modifier methods to the returned function

How `@alpinejs/persist` uses it (simplified):

```js
export default function (Alpine) {
    let persist = () => {
        let alias
        let storage = localStorage

        return Alpine.interceptor((initialValue, getter, setter, path, key) => {
            let lookup = alias || `_x_${path}`

            let initial = storage.getItem(lookup) !== null
                ? JSON.parse(storage.getItem(lookup))
                : initialValue

            setter(initial)

            Alpine.effect(() => {
                storage.setItem(lookup, JSON.stringify(getter()))
            })

            return initial
        }, func => {
            // Enables $persist(0).as('count').using(sessionStorage)
            func.as = key => { alias = key; return func }
            func.using = target => { storage = target; return func }
        })
    }

    Alpine.magic('persist', persist)

    // Also expose it outside expressions: Alpine.$persist(...)
    Object.defineProperty(Alpine, '$persist', { get: () => persist() })
}
```

Caution: the interceptor API is marked internal in core ("subject to change without a major release") — it is stable in practice (persist depends on it) but prefer plain magics when you don't need data-init hooking.

## Gotchas

- Magic getters are invoked lazily per access; don't do expensive setup in the getter body — memoize on the element if needed (core `$id` caches on `el._x_id`).
- To make a magic usable from bundle code as well (outside expressions where `$` magics don't exist), also expose it on the Alpine global like persist does above.
- Magics are not available inside `Alpine.store()` definitions (stores have no host element). They ARE available via `this` inside `Alpine.data()` components.
