# Crux Primitives — API Surface

Designed 2026-08-07. This is the v1 design for the headless primitives
package (layer 1). PLAN.md records why this shape was chosen over a
web-components wrapper.

## Design goals

1. **Terse, tag-like ergonomics** in the markup the developer owns —
   comparable to shadcn/Base UI's JSX, without a compile step or a second
   runtime.
2. **Engine-agnostic:** the same markup works pasted into Antlers, Blade,
   Twig, or a static `.html` file. Config must be writable by a templating
   engine emitting plain strings — no required Alpine expressions.
3. **Behavior lives in versioned JS:** every ARIA attribute, keyboard
   handler, focus move, and dismiss rule is applied by the package at
   runtime, so a11y fixes propagate via `npm update crux-ui`, even though
   users own their markup.
4. **Styling needs zero JS:** all visual state is exposed as `data-*`
   attributes, targetable from Tailwind (`data-open:…`) or plain CSS.
5. **Base UI alignment:** part names, data-attributes, and CSS variables
   follow Base UI's vocabulary wherever it exists, so shadcn-style class
   strings and styling patterns port to Crux templates with minimal
   translation.

## The grammar

Five conventions, uniform across every primitive:

### 1. Root directive + part directives

- Root: `x-<component>` — creates the component's reactive scope.
- Parts: `x-<component>:<part>` — one registered Alpine directive per
  component; the part name is the directive argument.

```html
<div x-accordion>
  <div x-accordion:item value="…">
    <button x-accordion:trigger>…</button>
    <div x-accordion:panel>…</div>
  </div>
</div>
```

Part names follow Base UI's vocabulary: `trigger`, `item`, `header`,
`panel` (disclosure family: collapsible, accordion, tabs), `popup` (overlay
family: popover, dialog, menu, select), `list`, `tab`, `backdrop`, `title`,
`description`, `close`, `arrow`.

### 2. Static config = plain kebab-case attributes

No expressions, no quoting gymnastics — a templating engine can emit these
directly (`default-value="{{ first_slug }}"`).

```html
<div x-accordion multiple default-value="shipping">
  <div x-tabs default-value="account" orientation="vertical" activation="manual">
    <div x-popover placement="bottom-start" offset="8"></div>
  </div>
</div>
```

- Boolean options are bare attributes (`multiple`, `default-open`).
- Multi-value strings are comma-separated (`default-value="a, b"`).
- `disabled` on the root disables the whole component; on an item/trigger it
  disables that item — skipped in keyboard navigation, reflected as
  `aria-disabled` + `data-disabled`.
- `hidden-until-found` on the root (Base UI's `hiddenUntilFound`): closed
  panels use `hidden="until-found"` so browser find-in-page (Cmd+F) can
  match text inside them — the package listens for `beforematch` and opens
  the panel with the match highlighted. Degrades to plain `hidden` in
  browsers without support.

Attribute names are Base UI prop names kebab-cased: `defaultValue` →
`default-value`, `defaultOpen` → `default-open`, `hiddenUntilFound` →
`hidden-until-found`. (`keepMounted` has no equivalent — server-rendered
markup is always mounted; that's the default reality here.)

### 3. Dynamic control = `x-model`

Each stateful root is modelable (implemented via Alpine's `x-modelable`
mechanism). `x-model` overrides `default-*` attributes and gives two-way
binding for the cases where surrounding state matters:

```html
<div x-data="{ open: ['shipping'] }">
  <div x-accordion x-model="open">…</div>
</div>

<div x-data="{ showConfirm: false }">
  <div x-dialog x-model="showConfirm">…</div>
</div>
```

Model value types: accordion → array of item values; tabs → string;
dialog/popover → boolean.

`disabled` outranks the model. A disabled root refuses every state change,
including a write from the bound variable, so the variable can hold a value
the component declines to take. Read the component's state from its
`data-*` attributes or its magic, not from the model, while it is disabled.

### 4. State out: data-attributes, magics, events

**Data-attributes** (the styling API — Base UI's scheme: boolean _presence_
attributes, not `data-state="…"` values):

| Attribute                            | Where                                                  | Meaning                           |
| ------------------------------------ | ------------------------------------------------------ | --------------------------------- |
| `data-open` / `data-closed`          | collapsible root, item, header, panel, popup, backdrop | present while open / while closed |
| `data-panel-open`                    | trigger (disclosure family)                            | present while its panel is open   |
| `data-popup-open`                    | trigger (overlay family)                               | present while its popup is open   |
| `data-selected` / `data-highlighted` | tab, menu/select item                                  | selection vs. keyboard highlight  |
| `data-disabled`                      | any part                                               | present when disabled             |
| `data-index`                         | item, header, panel                                    | item's index in the collection    |
| `data-orientation`                   | root, list, panel                                      | `horizontal` / `vertical`         |

Since the package also sets the real ARIA attributes (`aria-expanded`,
`aria-selected`, `aria-disabled`), Tailwind's `aria-*` variants work too —
shadcn's `group-aria-expanded/accordion-trigger:hidden` pattern ports
verbatim:

```html
<button x-accordion:trigger class="group/accordion-trigger flex w-full items-center">
  Shipping
  <svg
    data-slot="accordion-trigger-icon"
    class="transition-transform group-data-panel-open/accordion-trigger:rotate-180"
  >
    …
  </svg>
</button>
```

**`data-slot` convention:** identity markers like shadcn's
`data-slot="accordion-trigger"` / `…-trigger-icon` (used in parent-scoped
selectors like `**:data-[slot=accordion-trigger-icon]:size-4`) are
hand-authored in the registry templates, exactly as shadcn's styled layer
adds them on top of Base UI. Primitives don't stamp them at init — they
must exist in the server-rendered markup so slot-scoped styles apply before
Alpine boots, with no layout shift.

**CSS variables** — open panels expose their measured size for any CSS that
wants it, named per component to match Base UI: `--collapsible-panel-height`
/ `-width`, `--accordion-panel-height` / `-width`. Animation itself is
handled by Alpine's own `x-collapse` / `x-transition` (see below) — the
variables are informational, not an animation mechanism.

**Magics** (the logic API — resolve the nearest root from the element they're
used on, so they work anywhere inside it, including nested components):

```html
<span x-text="$accordion.value.length"></span>
<button @click="$accordion.toggle('returns')">…</button>
```

Per component: `$collapsible` (`isOpen`, `open()`, `close()`, `toggle()`),
`$accordion` (`value`, `isOpen(v)`, `open(v)`, `close(v)`, `toggle(v)`),
`$tabs` (`value`, `select(v)`, `isSelected(v)`), `$dialog` / `$popover`
(`isOpen`, `open()`, `close()`, `toggle()`).

**Events** — kebab-case CustomEvents dispatched from the root, bubbling:

```html
<div x-accordion @accordion-change="track($event.detail.value)"></div>
```

Naming: `<component>-change` for value changes; `<component>-open` /
`<component>-close` for overlays. (Kebab, not colon-namespaced — colons
collide with Alpine's `x-on:` argument parsing.)

Payload: `<component>-change` always carries `detail.value`, holding the
component's model value type (collapsible/dialog/popover → boolean, tabs →
string, accordion → array) — one payload shape across every primitive.

### 5. Composition with official Alpine plugins

Primitives control _whether_ a part is shown (bound through the same
mechanism as `x-show`, via `Alpine.bind`); the user's markup controls _how_
it transitions. `x-collapse`, `x-transition`, and `x-teleport` on a part
compose naturally:

```html
<div x-accordion:panel x-collapse hidden>…</div>
```

Alpine's transition plugins are the one and only animation mechanism —
Crux deliberately ships none of its own (Base UI's
`data-starting-style`/`data-ending-style` CSS hooks were considered and
rejected as duplicate machinery).

## Full example: accordion

```html
<div
  x-accordion
  default-value="shipping"
  class="max-w-lg divide-y divide-gray-200 rounded-lg border"
>
  <div x-accordion:item value="shipping" class="p-4">
    <h3 x-accordion:header class="flex">
      <button
        x-accordion:trigger
        data-slot="accordion-trigger"
        class="group/accordion-trigger flex flex-1 items-center justify-between py-2 text-left font-medium"
      >
        What are your shipping options?
        <svg
          data-slot="accordion-trigger-icon"
          class="pointer-events-none size-4 shrink-0 text-gray-500 transition-transform group-data-panel-open/accordion-trigger:rotate-180"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </h3>
    <div x-accordion:panel x-collapse hidden class="pb-3 pt-1 text-sm text-gray-600">
      We offer standard (5-7 days), express (2-3 days), and overnight shipping.
    </div>
  </div>

  <div x-accordion:item value="returns" class="p-4">
    <h3 x-accordion:header class="flex">
      <button x-accordion:trigger class="…">What is your return policy?</button>
    </h3>
    <div x-accordion:panel x-collapse hidden class="…">Returns accepted within 30 days.</div>
  </div>
</div>
```

(shadcn's two-icon variant works the same way: two svgs inside the trigger,
one with `group-data-panel-open/accordion-trigger:hidden`, the other with
`hidden group-data-panel-open/accordion-trigger:inline` — or the
`group-aria-expanded/accordion-trigger:*` equivalents.)

What the package wires up at init, per WAI-ARIA APG: trigger gets
`aria-expanded`, `aria-controls`, generated `id`, and `data-panel-open`;
panel gets `role="region"`, `aria-labelledby`, generated `id`; the header
part is where `role="heading"`/`aria-level` land when the user's element
isn't already an `<h1>`–`<h6>`; Enter/Space toggle; `data-open`/
`data-closed` + `data-index` on item, header, and panel; `hidden` is
removed and visibility taken over (respecting `x-collapse` /
`x-transition`).

## Sketches: how the grammar generalizes

```html
<!-- Collapsible: the accordion's little sibling — same parts, boolean state -->
<div x-collapsible default-open>
  <button x-collapsible:trigger class="group/collapsible-trigger">
    Advanced options
    <svg class="group-data-panel-open/collapsible-trigger:rotate-180">…</svg>
  </button>
  <div x-collapsible:panel x-collapse>…</div>
</div>

<!-- Tabs: roving tabindex, arrow/Home/End keys, automatic or manual activation -->
<div x-tabs default-value="account">
  <div x-tabs:list aria-label="Settings" class="flex gap-1 border-b">
    <button x-tabs:tab value="account" class="data-selected:border-b-2">Account</button>
    <button x-tabs:tab value="password">Password</button>
  </div>
  <div x-tabs:panel value="account">…</div>
  <div x-tabs:panel value="password" hidden>…</div>
</div>

<!-- Dialog: popup on a native <dialog> → top layer, ::backdrop, no teleport needed -->
<div x-dialog>
  <button x-dialog:trigger>Delete account</button>
  <dialog x-dialog:popup class="rounded-lg p-6 backdrop:bg-black/50">
    <h2 x-dialog:title>Are you sure?</h2>
    <p x-dialog:description>This cannot be undone.</p>
    <button x-dialog:close>Cancel</button>
  </dialog>
</div>

<!-- Popover: Floating UI positioning via attrs, arrow as a part -->
<div x-popover placement="bottom-start" offset="8">
  <button x-popover:trigger>Options</button>
  <div x-popover:popup hidden class="rounded-md border bg-white shadow-md">
    …
    <span x-popover:arrow></span>
  </div>
</div>
```

## Cross-cutting behavior (core utils, shared by all primitives)

- **IDs** — Alpine's own `x-id`/`$id` system: each root declares an id
  scope, parts call `$id()` inside it, so `aria-controls`/`aria-labelledby`
  wiring agrees per instance. Existing `id` attributes are respected, never
  overwritten.
- **Keyboard** — shared list-navigation util (roving tabindex, arrow keys,
  Home/End, typeahead) used by tabs, menu, select, etc. Each primitive's
  bindings follow its WAI-ARIA APG pattern, enumerated when built.
- **Dismiss layering** — a shared overlay stack so Escape and outside-click
  close only the topmost open layer (popover inside dialog behaves
  correctly).
- **Focus** — trap inside modal parts, restore to trigger on close. Core
  util owned by this package (not delegated to user markup).
- **Positioning** — direct `@floating-ui/dom` dependency (full middleware
  control: offset, flip, shift, size, arrow). `placement` / `offset` attrs
  on the root; `:arrow` part. Open popups expose `--anchor-width` /
  `--anchor-height` CSS variables (Base UI's names) measured from the
  trigger via the `size` middleware, so select/combobox popups can match
  trigger width with plain CSS (`w-(--anchor-width)` in Tailwind).
  (`@alpinejs/anchor` was considered and rejected: its ergonomics never
  reach users — Crux binds positioning internally from attrs — it bundles
  Floating UI anyway, and it hides the `arrow`/`size` middleware.)
- **Root resolution** — parts resolve their root via Alpine's scope chain,
  not `closest()`, so `x-teleport`-ed parts stay connected and nested
  same-type components bind to the nearest root.

## Package structure

```
src/
  index.js        # default export: registers every primitive
  accordion.js    # per-primitive entries: import accordion from 'crux-ui/accordion'
  tabs.js
  dialog.js
  …
  core/
    keynav.js  dismiss.js  focus.js  float.js
```

Core rule: reuse Alpine's own machinery before writing any custom
mechanism — `x-id`/`$id` for ids, `$dispatch` for events, `$watch` for
change tracking, `x-modelable` for `x-model`, `Alpine.bind` for applying
bindings, and `x-collapse`/`x-transition` for animation. Custom core utils
exist only for behavior Alpine has no primitive for (roving focus, dismiss
layering, focus trap, positioning).

Each primitive module exports `(Alpine) => void` registering its directive +
magic. The default plugin registers all; per-primitive entries exist for
bundle-conscious users. `alpinejs ^3.0.0` stays a peer dependency;
`@floating-ui/dom` becomes a real dependency once popover lands.

## No-JS / pre-init behavior

Registry templates ship initially-hidden parts with the native `hidden`
attribute (see examples above), so there is no flash of open content before
Alpine initializes and no `x-cloak` requirement. Default-open items simply
omit `hidden`. Content behind `hidden` remains indexable, and
`hidden-until-found` additionally opts closed panels into browser
find-in-page.

## Public contract (semver)

Breaking-change surface: directive and part names, config attributes,
`data-*` state attributes, CSS variables, event names/payloads, magic APIs,
and model value types. Internal DOM manipulation and core utils are not
public API.

## Build order

1. **Collapsible** — smallest disclosure; proves the whole grammar
   (root/part directives, attrs, x-model, data-state, events, magic).
2. **Accordion** — collapsible + item collection + value management.
3. **Tabs** — first keynav consumer (roving tabindex, orientation,
   activation modes).
4. **Popover** — first overlay: dismiss stack + Floating UI.
5. **Dialog** — focus trap/restore, native `<dialog>` top layer.
6. **Dropdown menu** — keynav + dismiss + floating combined.
7. **Tooltip** — hover/focus intent timing.
8. Then: select, combobox, radio group, switch, toast.
