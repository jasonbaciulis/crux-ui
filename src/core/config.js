/**
 * Reads a config attribute, static or bound with `:name="…"`. Alpine registers
 * inline bindings before any directive runs, so this works before the bind phase.
 */
export function readConfig(Alpine, el, name, fallback = null) {
  // `false` leaves the binding to x-bind as well, so the attribute still renders.
  return Alpine.extractProp(el, name, fallback, false)
}

// Alpine's rule: a bare attribute or "true" is true, and "false" is false.
export function readBooleanConfig(Alpine, el, name) {
  const value = readConfig(Alpine, el, name, false)
  return value !== 'false' && Boolean(value)
}

// Base UI's `disabled` is a live prop; the effect re-evaluates a bound
// `:disabled` whenever the data it reads changes.
export function syncDisabled(Alpine, el, state, effect) {
  effect(() => {
    state.disabled = readBooleanConfig(Alpine, el, 'disabled')
  })
}
