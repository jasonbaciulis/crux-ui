/**
 * An author's id is respected, never overwritten. Returns it, or null so the
 * part falls back to a generated `$id`.
 */
export function authorIdOf(el, directive) {
  if (!el.id) return null

  warnOnDuplicateId(el, directive)
  return el.id
}

// A hand-written id that another element already owns breaks the wiring
// silently, so say so at init instead of leaving it to devtools.
function warnOnDuplicateId(el, directive) {
  if (document.getElementById(el.id) !== el) {
    console.warn(`[Crux UI] Duplicate id "${el.id}" on ${directive}`, el)
  }
}
