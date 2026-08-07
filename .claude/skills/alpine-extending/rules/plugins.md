# Writing Plugins & Registration Lifecycle

## The One Rule of Timing

Extensions (`Alpine.directive`, `Alpine.magic`, `Alpine.data`, `Alpine.store`, `Alpine.bind`) must be registered **after Alpine loads but before it initializes the page**.

**Bundle** — register between import and `Alpine.start()`:

```js
import Alpine from 'alpinejs'
import intersect from '@alpinejs/intersect'
import myPlugin from './directives/myPlugin'

window.Alpine = Alpine
Alpine.plugin([intersect, myPlugin])   // accepts a single callback or an array
Alpine.start()
```

**Script tag** — register inside the `alpine:init` event listener:

```js
document.addEventListener('alpine:init', () => {
    Alpine.directive('foo', ...)
})
```

`alpine:initialized` fires after Alpine finishes initializing the page — use it for post-setup logic only, never for registering extensions.

## Plugin Shape

A plugin is just a function receiving the Alpine global. `Alpine.plugin(callback)` invokes it immediately (source: `src/plugin.js`):

```js
export default function (Alpine) {
    Alpine.directive('foo', (el, { expression }, { evaluateLater, effect, cleanup }) => {
        // ...
    })

    Alpine.magic('foo', el => {
        // ...
    })
}
```

Inside a plugin, use the `Alpine` parameter (and the `Alpine` utility passed to directive/magic handlers) instead of importing `alpinejs` — this keeps the plugin working with both the bundle and CDN builds and avoids double-bundling Alpine.

## Distributing a Plugin (dual CDN + module support)

Official plugins ship two builds from one source. The pattern:

```js
// builds/module.js — for bundlers
import plugin from '../src/index.js'
export default plugin

// builds/cdn.js — self-registering for script tags
import plugin from '../src/index.js'

document.addEventListener('alpine:init', () => {
    window.Alpine.plugin(plugin)
})
```

## CSP Build Caveat

If a site runs the `@alpinejs/csp` build, inline expressions are restricted (no arrow functions, template literals, globals like `Math`/`JSON`, property assignments like `user.name = 'x'`). Custom directives/magics still work, but complex logic must live in `Alpine.data()` components rather than inline expressions:

```js
Alpine.data('userManager', () => ({
    users: [],
    get hasActiveAdmins() {
        return this.users.filter(user => user.active && user.role === 'admin').length > 0
    },
}))
```
