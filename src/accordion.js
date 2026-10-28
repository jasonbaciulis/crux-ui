import { bindButton } from './core/button.js'
import { readBooleanConfig, readConfig, syncDisabled } from './core/config.js'
import { bindPanelVisibility } from './core/disclosure.js'
import { authorIdOf } from './core/ids.js'
import { closestState, openStateBindings } from './core/state.js'

// One id scope per item, keyed per part: `crux-ui-accordion-item-1-panel`.
// The number identifies the item, so its trigger and panel carry the same number.
const ITEM_ID_SCOPE = 'crux-ui-accordion-item'

const ROOT_STATE = { key: '__accordion', container: 'x-accordion' }
const ITEM_STATE = { key: '__accordionItem', container: 'x-accordion:item' }

const HEADING_TAG = /^H[1-6]$/

// Bindings get the data stack as `this`: the nearest item and its root.
const isItemOpen = (scope) => scope.__accordion.isOpen(scope.__accordionItem.value)
const isItemDisabled = (scope) => scope.__accordion.disabled || scope.__accordionItem.disabled
const triggerIdIn = (scope) =>
  scope.__accordionItem.authorTriggerId ?? scope.$id(ITEM_ID_SCOPE, 'trigger')
const panelIdIn = (scope) =>
  scope.__accordionItem.authorPanelId ?? scope.$id(ITEM_ID_SCOPE, 'panel')

// Every part of an item carries these; the trigger has data-panel-open in place of data-open.
const itemPartBindings = {
  ':data-disabled'() {
    return isItemDisabled(this) ? '' : false
  },
  ':data-index'() {
    return this.__accordion.items.indexOf(this.__accordionItem.element)
  },
}

const partInitializers = { item, header, trigger, panel }

const noopApi = {
  value: [],
  isOpen() {
    return false
  },
  open() {},
  close() {},
  toggle() {},
}

export default function accordion(Alpine) {
  // Registered before `bind` for the same reason as x-collapsible: root
  // bindings that read $accordion must find __accordion in scope.
  Alpine.directive('accordion', (el, { value }, utilities) => {
    const initializePart = value ? partInitializers[value] : root

    if (!initializePart) {
      console.warn(`[Crux UI] Unknown part "x-accordion:${value}"`, el)
      return
    }

    initializePart(el, Alpine, utilities)
  }).before('bind')

  Alpine.magic('accordion', (el) => {
    const state = Alpine.$data(el).__accordion

    if (!state) {
      console.warn('[Crux UI] $accordion was used outside of x-accordion', el)
      return noopApi
    }

    // A copy, so callers cannot push into state behind setOpen's back.
    return {
      get value() {
        return [...state.value]
      },
      isOpen(itemValue) {
        return state.isOpen(itemValue)
      },
      open(itemValue) {
        state.setOpen(itemValue, true)
      },
      close(itemValue) {
        state.setOpen(itemValue, false)
      },
      toggle(itemValue) {
        state.toggle(itemValue)
      },
    }
  })
}

function root(el, Alpine, { effect }) {
  Alpine.bind(el, {
    'x-data'() {
      return {
        __accordion: accordionState(Alpine, el),

        init() {
          this.$watch('__accordion.value', (value) => {
            this.$dispatch('accordion-change', { value: [...value] })
          })
        },
      }
    },
    // Inert without x-model on the element, as in x-collapsible.
    'x-modelable': '__accordion.value',
    ':data-disabled'() {
      return this.__accordion.disabled ? '' : false
    },
  })

  syncDisabled(Alpine, el, Alpine.$data(el).__accordion, effect)
}

function accordionState(Alpine, el) {
  return {
    value: valuesFromConfig(readConfig(Alpine, el, 'default-value', [])),
    multiple: readBooleanConfig(Alpine, el, 'multiple'),
    disabled: readBooleanConfig(Alpine, el, 'disabled'),
    untilFound: readBooleanConfig(Alpine, el, 'hidden-until-found'),
    items: [],
    isOpen(itemValue) {
      return this.value.includes(itemValue)
    },
    setOpen(itemValue, open) {
      // Without this, opening an open item in multiple mode would list it twice.
      if (open === this.isOpen(itemValue)) return

      if (!open) {
        this.value = this.value.filter((openValue) => openValue !== itemValue)
      } else if (this.multiple) {
        this.value = [...this.value, itemValue]
      } else {
        this.value = [itemValue]
      }
    },
    toggle(itemValue) {
      this.setOpen(itemValue, !this.isOpen(itemValue))
    },
    registerItem(itemElement) {
      this.items = [...this.items, itemElement].toSorted(byDocumentOrder)
    },
    unregisterItem(itemElement) {
      this.items = this.items.filter((registeredElement) => registeredElement !== itemElement)
    },
  }
}

// A bound `:default-value` can be an array; a static attribute is a comma-separated string.
function valuesFromConfig(config) {
  if (Array.isArray(config)) return [...config]

  return String(config)
    .split(',')
    .map((itemValue) => itemValue.trim())
    .filter(Boolean)
}

function byDocumentOrder(first, second) {
  return first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
}

function item(el, Alpine, { effect, cleanup }) {
  const rootState = closestState(Alpine, el, ROOT_STATE, 'x-accordion:item')
  if (!rootState) return

  Alpine.bind(el, {
    // Alpine runs x-id before x-data, so the x-data factory can already call $id.
    'x-id'() {
      return [ITEM_ID_SCOPE]
    },
    'x-data'() {
      return {
        __accordionItem: {
          // Base UI parity: an item without a value still works, through a generated one.
          value: readConfig(Alpine, el, 'value') ?? this.$id(ITEM_ID_SCOPE),
          disabled: readBooleanConfig(Alpine, el, 'disabled'),
          element: el,
          authorTriggerId: null,
          authorPanelId: null,
        },
      }
    },
    ...openStateBindings(isItemOpen),
    ...itemPartBindings,
  })

  syncDisabled(Alpine, el, Alpine.$data(el).__accordionItem, effect)
  rootState.registerItem(el)
  cleanup(() => rootState.unregisterItem(el))
}

function header(el, Alpine) {
  if (!closestState(Alpine, el, ITEM_STATE, 'x-accordion:header')) return

  if (!HEADING_TAG.test(el.tagName)) exposeAsHeading(el)

  Alpine.bind(el, { ...openStateBindings(isItemOpen), ...itemPartBindings })
}

// Base UI renders the header as an <h3>, so level 3 is the default.
function exposeAsHeading(el) {
  if (!el.hasAttribute('role')) el.setAttribute('role', 'heading')
  if (!el.hasAttribute('aria-level')) el.setAttribute('aria-level', '3')
}

function trigger(el, Alpine) {
  const itemState = closestState(Alpine, el, ITEM_STATE, 'x-accordion:trigger')
  if (!itemState) return

  // In state, so the panel's aria-labelledby points at the author's id too.
  itemState.authorTriggerId = authorIdOf(el, 'x-accordion:trigger')

  Alpine.bind(el, {
    ':id'() {
      return triggerIdIn(this)
    },
    ':aria-expanded'() {
      return isItemOpen(this) ? 'true' : 'false'
    },
    ':aria-controls'() {
      return panelIdIn(this)
    },
    ':data-panel-open'() {
      return isItemOpen(this) ? '' : false
    },
    ...itemPartBindings,
  })

  bindButton(Alpine, el, {
    isDisabled: isItemDisabled,
    activate: (scope) => scope.__accordion.toggle(scope.__accordionItem.value),
  })
}

function panel(el, Alpine, utilities) {
  const itemState = closestState(Alpine, el, ITEM_STATE, 'x-accordion:panel')
  if (!itemState) return

  // In state, so the trigger's aria-controls points at the author's id too.
  itemState.authorPanelId = authorIdOf(el, 'x-accordion:panel')

  Alpine.bind(el, {
    role: 'region',
    ':id'() {
      return panelIdIn(this)
    },
    ':aria-labelledby'() {
      return triggerIdIn(this)
    },
    ...openStateBindings(isItemOpen),
    ...itemPartBindings,
  })

  bindPanelVisibility(
    Alpine,
    el,
    {
      untilFound: Alpine.$data(el).__accordion.untilFound,
      variablePrefix: 'accordion',
      isOpen: isItemOpen,
      isDisabled: isItemDisabled,
      open: (scope) => scope.__accordion.setOpen(scope.__accordionItem.value, true),
    },
    utilities
  )
}
