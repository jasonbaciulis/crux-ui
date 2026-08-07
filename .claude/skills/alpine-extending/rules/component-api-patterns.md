# Component API Patterns

Best practices from the official docs for making reusable Alpine components feel like native elements — the consumer-facing API surface.

## x-modelable — Support `x-model` on Your Component

Expose internal state as an `x-model` target so a reusable component (e.g. a Blade/Antlers partial) binds like a native input:

```html
<div x-data="{ number: 5 }">
    <div x-data="{ count: 0 }" x-modelable="count" x-model="number">
        <button @click="count++">Increment</button>
    </div>

    Number: <span x-text="number"></span>
</div>
```

The child declares which internal property (`count`) the parent's `x-model` entangles with. Two-way: either side's change syncs the other. This is the docs' recommended pattern for backend-templated reusable components.

Related low-level pieces:
- `el._x_model.get()` / `el._x_model.set(value)` — programmatic access to an element's `x-model` binding.
- `$dispatch('input', value)` from a custom component triggers a parent's `x-model` listener directly (the pre-modelable technique).
- `Alpine.entangle` — the primitive behind `x-modelable`, for custom two-way syncs in plugins.

## $dispatch — Component Events

Communicate outward with custom events instead of reaching into other components' state:

```html
<button @click="$dispatch('notify', { message: 'Saved!' })">Save</button>
```

- Events bubble **up** — siblings never receive them. For component-to-component communication, listen with `.window`:

```html
<div x-data="notifications" @notify.window="add($event.detail.message)">...</div>
```

- `$dispatch(name, detail, options)` — third argument overrides `CustomEvent` defaults, e.g. `{ bubbles: false }`.
- Dispatch is cancelable: `if ($dispatch('open')) { open = true }` — false when a listener called `$event.preventDefault()`.
- HTML attributes are lowercase: listen to camelCase events with `@custom-event.camel`, dot-notation names with `@custom-event.dot`.

## x-id + $id — Collision-Free IDs for Accessibility

Repeated component instances need unique but internally-matching IDs (`<label for>` ↔ `<input id>`, `aria-controls`, `aria-labelledby`):

```html
<div x-id="['text-input']">
    <label :for="$id('text-input')">Username</label>  <!-- text-input-1 -->
    <input type="text" :id="$id('text-input')">       <!-- text-input-1 -->
</div>

<div x-id="['text-input']">
    <label :for="$id('text-input')">Username</label>  <!-- text-input-2 -->
    <input type="text" :id="$id('text-input')">       <!-- text-input-2 -->
</div>
```

- Within one `x-id` scope, every `$id('name')` returns the SAME suffixed ID; each new scope increments.
- Keyed variant for loops: `$id('list-item', item.id)` → `list-item-1-3` (e.g. `aria-activedescendant` pointing at `x-for` items).
- `x-id` scopes nest freely.

## x-teleport — Escaping Stacking Contexts

For modals/overlays inside deeply nested components:

```html
<template x-teleport="body">
    <div x-show="open">Modal contents...</div>
</template>
```

- Value is any CSS selector; resolved with `document.querySelector` (first match), content appended there.
- Teleported content keeps its Alpine scope (`$refs`, `$root`, component data).
- Events bubble at the teleported location — to listen across the boundary, put listeners on the `<template x-teleport>` element itself; Alpine re-dispatches copies from there.

## Refs Caveat

`$refs` only supports **static** refs. `:x-ref="item.name"` inside `x-for` does not evaluate — the literal string is stored. Use keyed `$id()` IDs or events instead for dynamic targeting.

## Timing

- `init()` (data object) runs before the element initializes; `x-init` attribute expression runs second.
- Reading DOM that depends on a just-changed property requires `$nextTick(() => ...)` (or `await $nextTick()`).
- `x-effect` runs on init AND on dependency change (auto-tracked); `$watch` is lazy and provides `(newValue, oldValue)`. Pick accordingly.
- `x-if` does not support `x-transition` — use `x-show` when animating.
