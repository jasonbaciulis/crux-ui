# General Guidelines
- Only report to me in ASD-STE100 Simplified Technical English.
- Before writing a guard, name the concrete caller or state that produces the condition. Can't name one → no guard; types and upstream gates count as proof.

## Naming

- Never use single-letter variable names in closures — use descriptive names.
- Spell a multi-word concept out wherever the name *is* the concept. Abbreviate only in lookup keys, which are grepped rather than read: config keys, `data-test` attributes.

## Self-documenting code
Code should be readable on its own. Use descriptive function and variable names instead of comments.
Extract multi-line conditions into a function whose name states the rule, instead of making the reader decode each clause at the call site.

Incorrect:
```js
// Check if the trigger can toggle the panel
if (
  !state.disabled &&
  !el.hasAttribute('aria-disabled') &&
  (el.tagName.toLowerCase() === 'button' || event.key === 'Enter' || event.key === ' ')
) {
```

Correct:
```js
if (activatesTrigger(el, state, event)) {
```

Not just conditions — any statements that together do one nameable step get extracted, so the calling function reads as a sequence of events instead of mechanics.

Incorrect:
```js
function openPanel(el, state) {
  state.setOpen(true)
  const { scrollHeight, scrollWidth } = el
  el.style.setProperty('--collapsible-panel-height', `${scrollHeight}px`)
  el.style.setProperty('--collapsible-panel-width', `${scrollWidth}px`)
}
```

Correct:
```js
function openPanel(el, state) {
  state.setOpen(true)
  publishPanelSize(el)
}
```

## Comment Style

Doc blocks and comments are capped at 1–2 sentences and allowed only for an invariant the code cannot show (a deliberate non-obvious choice). If a sentence describes what the code below does, delete it. Existing files with longer docblocks are legacy, not license — do not match their density.

Comment placement decides the syntax, not the comment's length:

- Use a doc block to document the declaration directly below it — a function, hook, constant. It explains *what the symbol is*.
- Use line comments (`//`) only for rationale attached to a statement inside a body. They explain *why a specific line does what it does*.
- A long comment is not automatically a doc block: a multiline explanation inside a function body still uses `//`.
