# Alpine.data, Alpine.store, Alpine.bind & Reactivity Primitives

## Alpine.data() — Reusable Components

The primary pattern for extracting component logic out of markup. Register before `Alpine.start()` (bundle) or in `alpine:init` (script tag); reference by name in `x-data`:

```js
// dropdown.js
export default () => ({
    open: false,
    toggle() {
        this.open = ! this.open
    },
})
```

```js
Alpine.data('dropdown', dropdown)
```

```html
<div x-data="dropdown">
    <button @click="toggle">...</button>
    <div x-show="open">...</div>
</div>
```

### Initial parameters

```js
Alpine.data('dropdown', (initialOpenState = false) => ({
    open: initialOpenState,
}))
```

```html
<div x-data="dropdown(true)"></div>
```

### Lifecycle hooks

- `init()` — called automatically before the element initializes. If the element also has an `x-init` attribute, `init()` runs first.
- `destroy()` — called before cleanup (element removed via `x-if`, morphing, etc.). Release timers, observers, external listeners here.

```js
Alpine.data('timer', () => ({
    timer: null,
    counter: 0,
    init() {
        this.timer = setInterval(() => this.counter++, 1000)
    },
    destroy() {
        clearInterval(this.timer)
    },
}))
```

### Magics via `this`

All magics are available on `this` inside `Alpine.data()` components:

```js
Alpine.data('dropdown', () => ({
    open: false,
    init() {
        this.$watch('open', isOpen => this.$dispatch('dropdown-toggled', { isOpen }))
    },
}))
```

### Getters as computed properties

```js
Alpine.data('cart', () => ({
    items: [],
    get total() {
        return this.items.reduce((sum, item) => sum + item.price, 0)
    },
}))
```

Getters are evaluated per access (not cached), but reads inside them are reactively tracked like any expression.

### Encapsulating directives with x-bind objects

Package directive bundles (behavior + ARIA) as properties, applied with valueless `x-bind`:

```js
Alpine.data('dropdown', () => ({
    open: false,

    trigger: {
        ['x-ref']: 'trigger',
        ['@click']() { this.open = true },
    },

    dialogue: {
        ['x-show']() { return this.open },
        ['@click.outside']() { this.open = false },
    },
}))
```

```html
<div x-data="dropdown">
    <button x-bind="trigger">Open</button>
    <span x-bind="dialogue">Contents</span>
</div>
```

Caveat: `x-for` in a binding object must return a string expression: `['x-for']() { return 'item in items' }`.

## Alpine.store() — Global State

```js
Alpine.store('darkMode', {
    on: false,

    init() {
        // Runs at registration, before Alpine renders anything
        this.on = window.matchMedia('(prefers-color-scheme: dark)').matches
    },

    toggle() {
        this.on = ! this.on
    },
})
```

- Access in expressions via `$store.darkMode.on`; changes propagate reactively to every component reading the store.
- Access outside templates: `Alpine.store('darkMode')` (getter form — omit the second argument).
- Single-value stores are allowed: `Alpine.store('darkMode', false)` then `$store.darkMode = ! $store.darkMode`.
- Stores have no host element, so element-bound magics (`$el`, `$dispatch`, `$watch`…) are unavailable inside them.

## Alpine.bind() — Reusable Binding Objects

Same object shape as x-bind encapsulation, but registered globally and evaluated in the consuming component's scope:

```js
Alpine.bind('SubmitButton', () => ({
    type: 'button',

    '@click'() {
        this.doSomething()
    },

    ':disabled'() {
        return this.shouldDisable
    },
}))
```

```html
<button x-bind="SubmitButton"></button>
```

## Reactivity Primitives

Alpine re-exports Vue's reactivity engine. Useful in plugins and framework-less glue code:

| API | Purpose |
|---|---|
| `Alpine.reactive(obj)` | Wrap an object in a reactive Proxy (writes reflect both ways) |
| `Alpine.effect(callback)` | Run callback now and re-run whenever reactive data it read changes. **No auto-cleanup** — inside directives/magics use the injected element-bound `effect` instead |
| `Alpine.release(effectReference)` | Manually release an effect created with `Alpine.effect` |
| `Alpine.raw(reactiveObj)` | Unwrap a reactive proxy to the raw object |
| `Alpine.watch(getter, callback)` | Deep-watch a getter's value; returns an unwatch function. Callback gets `(newValue, oldValue)` |
| `Alpine.nextTick(callback)` | Run after Alpine flushes pending DOM updates; returns a promise |

Standalone reactivity example:

```js
let data = Alpine.reactive({ count: 1 })

Alpine.effect(() => {
    span.textContent = data.count
})

data.count++ // span updates automatically
```

### $watch gotchas (apply to Alpine.watch too)

- Watching an object fires on any nested change (deep by default), and the callback receives the whole object.
- Mutating the watched value inside its own callback causes an infinite loop.

## Other Useful Extension Utilities on the Alpine Global

Verified in `node_modules/alpinejs/src/alpine.js`:

- `Alpine.debounce(fn, wait)` / `Alpine.throttle(fn, wait)`
- `Alpine.mutateDom(callback)` — perform DOM mutations Alpine's observer should ignore
- `Alpine.skipDuringClone(fn)` / `Alpine.onlyDuringClone(fn)` — Livewire/morph safety wrappers for directive handlers
- `Alpine.addScopeToNode(el, scopeObject)` — inject scope for descendants (pair with `.before('bind')` ordering)
- `Alpine.entangle({ get, set }, { get, set })` — two-way sync between two reactive sources (powers `x-modelable`); returns a release function
- `Alpine.bound(el, 'attribute', fallback)` — read an attribute's bound (or static) value
- `Alpine.$data(el)` — the merged Alpine scope for an element
- `Alpine.closestRoot(el)` / `Alpine.findClosest(el, predicate)` — walk up to component roots
- `Alpine.initTree(el)` / `Alpine.destroyTree(el)` — manually initialize/teardown a DOM subtree (e.g. content injected by fetch)
- `Alpine.interceptInit(callback)` / `Alpine.addRootSelector(callback)` — deep hooks used by plugins that add new "root" concepts (rarely needed)
