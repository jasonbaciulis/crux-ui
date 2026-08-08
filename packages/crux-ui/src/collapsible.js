// One id scope per root, keyed per part: `crux-ui-collapsible-1-panel`.
// The number identifies the instance, so every part of one collapsible
// carries the same number.
const ID_SCOPE = 'crux-ui-collapsible'

const openClosedBindings = {
  ':data-open'() {
    return this.__collapsible.open ? '' : false
  },
  ':data-closed'() {
    return this.__collapsible.open ? false : ''
  },
}

const disabledBinding = {
  ':data-disabled'() {
    return this.__collapsible.disabled ? '' : false
  },
}

const nativeButtonBindings = {
  ':disabled'() {
    return this.__collapsible.disabled
  },
}

// Gates `disabled` at the button, not in state: activating the
// trigger does nothing, while x-model and $collapsible still set state.
function handleTrigger() {
  if (this.__collapsible.disabled) return
  this.__collapsible.toggle()
}

const buttonRoleBindings = {
  role: 'button',
  tabindex: '0',
  ':aria-disabled'() {
    return this.__collapsible.disabled ? 'true' : false
  },
  '@keydown.enter.prevent': handleTrigger,
  '@keydown.space.prevent': handleTrigger,
}

const displayBinding = {
  'x-show'() {
    return this.__collapsible.open
  },
}

/**
 * hidden="until-found" keeps closed content findable by find-in-page,
 * and it cannot combine with display:none — so this panel gets
 * no x-show and no JS transitions.
 */
const untilFoundBinding = {
  ':hidden'() {
    return this.__collapsible.open ? false : 'until-found'
  },
}

// `scope` is the bindings-object `this`: the data stack plus Alpine's magics.
const panelIdIn = (scope) => scope.__collapsible.authorPanelId ?? scope.$id(ID_SCOPE, 'panel')

const partInitializers = { trigger, panel }

const noopApi = { isOpen: false, open() {}, close() {}, toggle() {} }

export default function collapsible(Alpine) {
  // Custom directives normally run in the last slot, after the element's own
  // x-bind/x-show/x-model — root bindings that read $collapsible would capture
  // a scope without __collapsible and never recover. x-model still pairs up,
  // because x-modelable entangles in a microtask.
  Alpine.directive('collapsible', (el, { value }, utilities) => {
    const initializePart = value ? partInitializers[value] : root

    if (!initializePart) {
      console.warn(`[Crux UI] Unknown part "x-collapsible:${value}"`, el)
      return
    }

    initializePart(el, Alpine, utilities)
  }).before('bind')

  Alpine.magic('collapsible', (el) => {
    const state = Alpine.$data(el).__collapsible

    if (!state) {
      console.warn('[Crux UI] $collapsible was used outside of x-collapsible', el)
      return noopApi
    }

    // These getters must close over the reactive proxy above, never the raw
    // object that collapsibleState() returns — a raw read gets the right
    // value but registers no dependency, so nothing re-renders.
    return {
      get isOpen() {
        return state.open
      },
      open() {
        state.open = true
      },
      close() {
        state.open = false
      },
      toggle() {
        state.toggle()
      },
    }
  })
}

function root(el, Alpine) {
  Alpine.bind(el, {
    'x-data'() {
      return {
        __collapsible: collapsibleState(el),

        init() {
          this.$watch('__collapsible.open', (open) => {
            this.$dispatch('collapsible-change', { value: open })
          })
        },
      }
    },
    // Scopes the generated id to this root, so trigger and panel agree on it.
    'x-id'() {
      return [ID_SCOPE]
    },
    // Without x-model on the element this is inert (Alpine only entangles
    // when el._x_model exists), so it's safe to bind unconditionally.
    'x-modelable': '__collapsible.open',
    ...openClosedBindings,
    ...disabledBinding,
  })
}

function collapsibleState(el) {
  return {
    open: el.hasAttribute('default-open'),
    disabled: el.hasAttribute('disabled'),
    untilFound: el.hasAttribute('hidden-until-found'),
    authorPanelId: null,
    toggle() {
      this.open = !this.open
    },
  }
}

function trigger(el, Alpine) {
  const state = closestState(Alpine, el, 'trigger')
  if (!state) return

  const isNativeButton = el.tagName.toLowerCase() === 'button'
  if (isNativeButton && !el.hasAttribute('type')) el.setAttribute('type', 'button')

  Alpine.bind(el, {
    ':aria-expanded'() {
      return this.__collapsible.open ? 'true' : 'false'
    },
    ':aria-controls'() {
      return panelIdIn(this)
    },
    ':data-panel-open'() {
      return this.__collapsible.open ? '' : false
    },
    ...disabledBinding,
    '@click': handleTrigger,
    ...(isNativeButton ? nativeButtonBindings : buttonRoleBindings),
  })
}

function panel(el, Alpine, { effect, cleanup }) {
  const state = closestState(Alpine, el, 'panel')
  if (!state) return

  // An author's id is respected, never overwritten; it goes into state so
  // every trigger points at it instead of at a generated one.
  if (el.id) {
    state.authorPanelId = el.id
    warnOnDuplicateId(el)
  }

  Alpine.bind(el, {
    ':id'() {
      return panelIdIn(this)
    },
    ...openClosedBindings,
    ...(state.untilFound ? untilFoundBinding : displayBinding),
  })

  if (state.untilFound) {
    openOnFindInPage(el, state, cleanup)
  } else {
    // Templates ship `hidden` to prevent pre-init flash; x-show has already
    // applied display:none synchronously if closed, so this is safe.
    el.removeAttribute('hidden')
  }

  publishPanelSize(el, state, effect, cleanup)
}

// A hand-written id that another element already owns breaks the wiring
// silently, so say so at init instead of leaving it to devtools.
function warnOnDuplicateId(el) {
  if (document.getElementById(el.id) !== el) {
    console.warn(`[Crux UI] Duplicate id "${el.id}" on x-collapsible:panel`, el)
  }
}

function openOnFindInPage(el, state, cleanup) {
  const onBeforeMatch = () => {
    if (state.disabled) {
      // The browser strips `hidden` after beforematch; a disabled
      // collapsible must stay closed, so put it back on the next frame.
      requestAnimationFrame(() => el.setAttribute('hidden', 'until-found'))
      return
    }
    state.open = true
  }

  el.addEventListener('beforematch', onBeforeMatch)
  cleanup(() => el.removeEventListener('beforematch', onBeforeMatch))
}

/**
 * Base UI parity: the open panel measures itself into CSS variables.
 */
function publishPanelSize(el, state, effect, cleanup) {
  let measurementFrame

  effect(() => {
    cancelAnimationFrame(measurementFrame)
    if (!state.open) return
    measurementFrame = requestAnimationFrame(() => {
      // Read both dimensions before writing — a write between the two
      // reads would force a second layout pass.
      const { scrollHeight, scrollWidth } = el
      el.style.setProperty('--collapsible-panel-height', `${scrollHeight}px`)
      el.style.setProperty('--collapsible-panel-width', `${scrollWidth}px`)
    })
  })

  cleanup(() => cancelAnimationFrame(measurementFrame))
}

function closestState(Alpine, el, part) {
  const state = Alpine.$data(el).__collapsible

  if (!state) {
    console.warn(`[Crux UI] x-collapsible:${part} must be inside x-collapsible`, el)
  }

  return state
}
