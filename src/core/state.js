/**
 * Finds the nearest component state stored under `key`, or warns that `part`
 * is used outside its `container` directive.
 */
export function closestState(Alpine, el, { key, container }, part) {
  const state = Alpine.$data(el)[key]

  if (!state) {
    console.warn(`[Crux UI] ${part} must be inside ${container}`, el)
  }

  return state
}

/**
 * Base UI's open-state styling hooks. `isOpen` receives the element's Alpine scope.
 */
export function openStateBindings(isOpen) {
  return {
    ':data-open'() {
      return isOpen(this) ? '' : false
    },
    ':data-closed'() {
      return isOpen(this) ? false : ''
    },
  }
}
