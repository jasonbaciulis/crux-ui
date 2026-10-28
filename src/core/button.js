/**
 * Base UI's useButton: one activation contract for every trigger. Accessors
 * receive the element's Alpine scope.
 */
export function bindButton(Alpine, el, { isDisabled, activate }) {
  // Gates `disabled` at the button, not in state: activating it does nothing,
  // while x-model and the magics still set state.
  function handleActivation() {
    if (isDisabled(this)) return
    activate(this)
  }

  if (el.tagName.toLowerCase() === 'button') {
    if (!el.hasAttribute('type')) el.setAttribute('type', 'button')

    Alpine.bind(el, {
      ':disabled'() {
        return isDisabled(this)
      },
      '@click': handleActivation,
    })
    return
  }

  Alpine.bind(el, {
    role: 'button',
    tabindex: '0',
    ':aria-disabled'() {
      return isDisabled(this) ? 'true' : false
    },
    '@click': handleActivation,
    '@keydown.enter.prevent': handleActivation,
    '@keydown.space.prevent': handleActivation,
  })
}
