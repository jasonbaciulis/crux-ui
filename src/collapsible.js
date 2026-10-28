import { bindButton } from './core/button.js'
import { readBooleanConfig, syncDisabled } from './core/config.js'
import { bindPanelVisibility } from './core/disclosure.js'
import { authorIdOf } from './core/ids.js'
import { closestState, openStateBindings } from './core/state.js'

// One id scope per root, keyed per part: `crux-ui-collapsible-1-panel`.
// The number identifies the instance, so every part of one collapsible
// carries the same number.
const ID_SCOPE = 'crux-ui-collapsible'

const ROOT_STATE = { key: '__collapsible', container: 'x-collapsible' }

const disabledBinding = {
  ':data-disabled'() {
    return this.__collapsible.disabled ? '' : false
  },
}

// Accessors for the shared core bindings; each receives the element's Alpine scope.
const isDisabled = (scope) => scope.__collapsible.disabled
const isOpen = (scope) => scope.__collapsible.open

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

function root(el, Alpine, { effect }) {
  Alpine.bind(el, {
    'x-data'() {
      return {
        __collapsible: collapsibleState(Alpine, el),

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
    ...openStateBindings(isOpen),
    ...disabledBinding,
  })

  syncDisabled(Alpine, el, Alpine.$data(el).__collapsible, effect)
}

function collapsibleState(Alpine, el) {
  return {
    open: readBooleanConfig(Alpine, el, 'default-open'),
    disabled: readBooleanConfig(Alpine, el, 'disabled'),
    untilFound: readBooleanConfig(Alpine, el, 'hidden-until-found'),
    authorPanelId: null,
    toggle() {
      this.open = !this.open
    },
  }
}

function trigger(el, Alpine) {
  const state = closestState(Alpine, el, ROOT_STATE, 'x-collapsible:trigger')
  if (!state) return

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
  })

  bindButton(Alpine, el, {
    isDisabled,
    activate: (scope) => scope.__collapsible.toggle(),
  })
}

function panel(el, Alpine, utilities) {
  const state = closestState(Alpine, el, ROOT_STATE, 'x-collapsible:panel')
  if (!state) return

  // In state, so the trigger's aria-controls points at the author's id too.
  state.authorPanelId = authorIdOf(el, 'x-collapsible:panel')

  Alpine.bind(el, {
    ':id'() {
      return panelIdIn(this)
    },
    ...openStateBindings(isOpen),
  })

  bindPanelVisibility(
    Alpine,
    el,
    {
      untilFound: state.untilFound,
      variablePrefix: 'collapsible',
      isOpen,
      isDisabled,
      open: (scope) => {
        scope.__collapsible.open = true
      },
    },
    utilities
  )
}
