/**
 * Shows and hides a disclosure panel and measures it while open. Accessors
 * receive the panel's Alpine scope.
 */
export function bindPanelVisibility(Alpine, el, panel, utilities) {
  const scope = Alpine.$data(el)

  Alpine.bind(el, panel.untilFound ? untilFoundBinding(panel.isOpen) : displayBinding(panel.isOpen))

  if (panel.untilFound) {
    openOnFindInPage(el, scope, panel, utilities)
  } else {
    // Templates ship `hidden` to prevent pre-init flash; x-show has already
    // applied display:none synchronously if closed, so this is safe.
    el.removeAttribute('hidden')
  }

  publishPanelSize(el, scope, panel, utilities)
}

function displayBinding(isOpen) {
  return {
    'x-show'() {
      return isOpen(this)
    },
  }
}

/**
 * hidden="until-found" keeps closed content findable by find-in-page,
 * and it cannot combine with display:none — so this panel gets
 * no x-show and no JS transitions.
 */
function untilFoundBinding(isOpen) {
  return {
    ':hidden'() {
      return isOpen(this) ? false : 'until-found'
    },
  }
}

function openOnFindInPage(el, scope, { isDisabled, open }, { cleanup }) {
  const onBeforeMatch = () => {
    if (isDisabled(scope)) {
      // The browser strips `hidden` after beforematch; a disabled
      // panel must stay closed, so put it back on the next frame.
      requestAnimationFrame(() => el.setAttribute('hidden', 'until-found'))
      return
    }
    open(scope)
  }

  el.addEventListener('beforematch', onBeforeMatch)
  cleanup(() => el.removeEventListener('beforematch', onBeforeMatch))
}

/**
 * Base UI parity: the open panel measures itself into CSS variables.
 */
function publishPanelSize(el, scope, { isOpen, variablePrefix }, { effect, cleanup }) {
  let measurementFrame
  let wasOpen = false

  effect(() => {
    const open = isOpen(scope)
    // When panels share one state, each value change reruns this effect;
    // only this panel's own open/close needs a new measurement.
    if (open === wasOpen) return
    wasOpen = open

    cancelAnimationFrame(measurementFrame)
    if (!open) return
    measurementFrame = requestAnimationFrame(() => {
      // Read both dimensions before writing — a write between the two
      // reads would force a second layout pass.
      const { scrollHeight, scrollWidth } = el
      el.style.setProperty(`--${variablePrefix}-panel-height`, `${scrollHeight}px`)
      el.style.setProperty(`--${variablePrefix}-panel-width`, `${scrollWidth}px`)
    })
  })

  cleanup(() => cancelAnimationFrame(measurementFrame))
}
