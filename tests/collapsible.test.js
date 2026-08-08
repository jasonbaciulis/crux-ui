import Alpine from 'alpinejs'
import collapse from '@alpinejs/collapse'
import Crux from '../src/index.js'

// Alpine picks up injected markup via MutationObserver; a macrotask
// guarantees init has run.
const flush = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
const animationFrame = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })

// Alpine applies x-show display changes on the next animation frame, so
// assertions about a toggled panel's display need to settle through one.
const settle = async () => {
  await flush()
  await animationFrame()
  await flush()
}

beforeAll(() => {
  window.Alpine = Alpine
  Alpine.plugin(collapse)
  Alpine.plugin(Crux)
  Alpine.start()
})

afterEach(async () => {
  document.body.replaceChildren()
  await flush()
})

async function mount(html) {
  document.body.innerHTML = html
  await flush()
  return document.body.firstElementChild
}

const parts = (root) => ({
  trigger: root.querySelector(String.raw`[x-collapsible\:trigger]`),
  panel: root.querySelector(String.raw`[x-collapsible\:panel]`),
})

// The canonical trigger+panel skeleton most tests share; options carry the
// per-test attribute variations.
async function mountCollapsible({ root = '', panel = 'hidden', trigger = 'button' } = {}) {
  const el = await mount(`
    <div x-collapsible ${root}>
      <${trigger} x-collapsible:trigger>Toggle</${trigger}>
      <div x-collapsible:panel ${panel}>Content</div>
    </div>
  `)
  return { root: el, ...parts(el) }
}

describe('x-collapsible', () => {
  it('initializes closed by default with full ARIA wiring', async () => {
    const { root, trigger, panel } = await mountCollapsible()

    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.getAttribute('aria-controls')).toBe(panel.id)
    expect(trigger.getAttribute('type')).toBe('button')
    expect(panel.id).toMatch(/^crux-ui-collapsible-\d+-panel$/)
    // Nothing points at the trigger, so it gets no generated id — same as
    // Base UI's collapsible trigger and Alpine UI's disclosure button.
    expect(trigger.id).toBe('')
    expect(panel.hasAttribute('hidden')).toBe(false)
    expect(panel.style.display).toBe('none')
    expect(root.hasAttribute('data-closed')).toBe(true)
    expect(root.hasAttribute('data-open')).toBe(false)
    expect(panel.hasAttribute('data-closed')).toBe(true)
    expect(trigger.hasAttribute('data-panel-open')).toBe(false)
  })

  it('respects default-open', async () => {
    const { root, trigger, panel } = await mountCollapsible({
      root: 'default-open',
      panel: '',
    })

    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(panel.style.display).not.toBe('none')
    expect(root.hasAttribute('data-open')).toBe(true)
    expect(panel.hasAttribute('data-open')).toBe(true)
    expect(trigger.hasAttribute('data-panel-open')).toBe(true)
  })

  it('toggles on click and dispatches collapsible-change', async () => {
    const { trigger, panel } = await mountCollapsible()
    const events = []
    document.addEventListener('collapsible-change', (event) => {
      events.push(event.detail.value)
    })

    trigger.click()
    await settle()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(panel.style.display).not.toBe('none')
    expect(events).toEqual([true])

    trigger.click()
    await settle()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(panel.style.display).toBe('none')
    expect(events).toEqual([true, false])
  })

  it('exposes the panel size as CSS variables when open', async () => {
    const { trigger, panel } = await mountCollapsible()

    expect(panel.style.getPropertyValue('--collapsible-panel-height')).toBe('')

    trigger.click()
    await settle()
    expect(panel.style.getPropertyValue('--collapsible-panel-height')).toMatch(/px$/)
    expect(panel.style.getPropertyValue('--collapsible-panel-width')).toMatch(/px$/)
  })

  it('supports x-model as controlled state', async () => {
    const root = await mount(`
      <div x-data="{ expanded: true }">
        <div x-collapsible x-model="expanded">
          <button x-collapsible:trigger>Toggle</button>
          <div x-collapsible:panel hidden>Content</div>
        </div>
        <span x-text="String(expanded)"></span>
      </div>
    `)
    const { trigger, panel } = parts(root)
    const mirror = root.querySelector('span')

    // outer state wins over the missing default-open (the sync from the
    // outer scope lands after init, so settle through a frame)
    await settle()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(panel.style.display).not.toBe('none')

    trigger.click()
    await settle()
    expect(mirror.textContent).toBe('false')
    expect(panel.style.display).toBe('none')
  })

  it('follows x-model changes made from the outer scope', async () => {
    const root = await mount(`
      <div x-data="{ expanded: false }">
        <div x-collapsible x-model="expanded">
          <button x-collapsible:trigger>Toggle</button>
          <div x-collapsible:panel hidden>Content</div>
        </div>
        <button type="button" id="open-outside" @click="expanded = true">Open</button>
        <button type="button" id="close-outside" @click="expanded = false">Close</button>
      </div>
    `)
    const { trigger, panel } = parts(root)
    const collapsible = root.querySelector('[x-collapsible]')

    await settle()
    expect(collapsible.hasAttribute('data-open')).toBe(false)

    root.querySelector('#open-outside').click()
    await settle()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(panel.style.display).not.toBe('none')

    root.querySelector('#close-outside').click()
    await settle()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(panel.style.display).toBe('none')
  })

  it('lets x-model override default-open', async () => {
    const root = await mount(`
      <div x-data="{ expanded: false }">
        <div x-collapsible default-open x-model="expanded">
          <button x-collapsible:trigger>Toggle</button>
          <div x-collapsible:panel>Content</div>
        </div>
      </div>
    `)
    const collapsible = root.querySelector('[x-collapsible]')

    await settle()
    expect(collapsible.hasAttribute('data-open')).toBe(false)
    expect(parts(root).trigger.getAttribute('aria-expanded')).toBe('false')
  })

  // Base UI defines `disabled` as "ignore user interaction", so app-initiated
  // state still lands and the model can never disagree with the component.
  it('still follows x-model while disabled', async () => {
    const root = await mount(`
      <div x-data="{ expanded: false }">
        <div x-collapsible disabled x-model="expanded">
          <button x-collapsible:trigger>Toggle</button>
          <div x-collapsible:panel hidden>Content</div>
        </div>
        <button type="button" id="open-outside" @click="expanded = true">Open</button>
      </div>
    `)
    const collapsible = root.querySelector('[x-collapsible]')

    root.querySelector('#open-outside').click()
    await settle()
    expect(collapsible.hasAttribute('data-open')).toBe(true)
    expect(parts(root).trigger.getAttribute('aria-expanded')).toBe('true')
    expect(collapsible.hasAttribute('data-disabled')).toBe(true)
  })

  it('initializes state before user bindings on the root element', async () => {
    // Root-level bindings run in the `bind` slot; the directive registers
    // with .before('bind') so its scope exists by then — otherwise
    // $collapsible would resolve to the non-reactive noop API.
    const { root, trigger } = await mountCollapsible({
      root: `:data-user-open="$collapsible.isOpen ? '' : false"`,
    })

    expect(root.hasAttribute('data-user-open')).toBe(false)

    trigger.click()
    await flush()
    expect(root.hasAttribute('data-user-open')).toBe(true)
  })

  it('honors disabled', async () => {
    const { root, trigger } = await mountCollapsible({ root: 'disabled' })

    expect(root.hasAttribute('data-disabled')).toBe(true)
    expect(trigger.hasAttribute('data-disabled')).toBe(true)
    expect(trigger.disabled).toBe(true)

    trigger.click()
    await flush()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  // A native button ignores clicks by itself, so a div trigger is the only way
  // to reach the disabled guard on the interaction handlers.
  it('ignores user interaction while disabled', async () => {
    const root = await mount(`
      <div x-collapsible disabled>
        <div x-collapsible:trigger>Toggle</div>
        <div x-collapsible:panel hidden>Content</div>
      </div>
    `)
    const { trigger } = parts(root)

    expect(trigger.getAttribute('aria-disabled')).toBe('true')

    trigger.click()
    await flush()
    expect(root.hasAttribute('data-open')).toBe(false)

    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await flush()
    expect(root.hasAttribute('data-open')).toBe(false)

    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    await flush()
    expect(root.hasAttribute('data-open')).toBe(false)
  })

  it('still obeys $collapsible while disabled', async () => {
    const root = await mount(`
      <div x-collapsible disabled>
        <button x-collapsible:trigger>Toggle</button>
        <div x-collapsible:panel hidden>Content</div>
        <button type="button" id="via-magic" @click="$collapsible.open()">Open</button>
      </div>
    `)

    root.querySelector('#via-magic').click()
    await flush()
    expect(root.hasAttribute('data-open')).toBe(true)
    expect(parts(root).trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('leaves author a11y attributes on the trigger alone', async () => {
    const root = await mount(`
      <h3 id="shipping-heading">Shipping</h3>
      <div x-collapsible>
        <button x-collapsible:trigger id="my-trigger" aria-label="Toggle shipping">
          <svg aria-hidden="true"></svg>
        </button>
        <div x-collapsible:panel hidden>Content</div>
      </div>
    `)
    const collapsible = document.querySelector('[x-collapsible]')
    const { trigger, panel } = parts(collapsible)

    expect(root.id).toBe('shipping-heading')
    expect(trigger.id).toBe('my-trigger')
    expect(trigger.getAttribute('aria-label')).toBe('Toggle shipping')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.getAttribute('aria-controls')).toBe(panel.id)
  })

  it('makes non-button triggers keyboard-operable', async () => {
    const { trigger } = await mountCollapsible({ trigger: 'div' })

    expect(trigger.getAttribute('role')).toBe('button')
    expect(trigger.getAttribute('tabindex')).toBe('0')

    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await flush()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    await flush()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('exposes the $collapsible magic within the root', async () => {
    const root = await mount(`
      <div x-collapsible>
        <button x-collapsible:trigger>Toggle</button>
        <div x-collapsible:panel hidden>Content</div>
        <span x-text="String($collapsible.isOpen)"></span>
        <button type="button" id="outside-toggle" @click="$collapsible.toggle()">via magic</button>
      </div>
    `)
    const mirror = root.querySelector('span')

    expect(mirror.textContent).toBe('false')
    root.querySelector('#outside-toggle').click()
    await flush()
    expect(mirror.textContent).toBe('true')
  })

  it('scopes nested collapsibles to the nearest root', async () => {
    const root = await mount(`
      <div x-collapsible default-open id="outer">
        <button x-collapsible:trigger>Outer</button>
        <div x-collapsible:panel>
          <div x-collapsible id="inner">
            <button x-collapsible:trigger>Inner</button>
            <div x-collapsible:panel hidden>Inner content</div>
          </div>
        </div>
      </div>
    `)
    const inner = root.querySelector('#inner')
    const innerTrigger = inner.querySelector(String.raw`[x-collapsible\:trigger]`)
    const outerTrigger = root.querySelector(String.raw`[x-collapsible\:trigger]`)

    innerTrigger.click()
    await flush()
    expect(inner.hasAttribute('data-open')).toBe(true)
    expect(root.hasAttribute('data-open')).toBe(true)
    expect(outerTrigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('preserves an author-provided panel id', async () => {
    const { trigger, panel } = await mountCollapsible({
      panel: 'id="my-panel" hidden',
    })

    expect(panel.id).toBe('my-panel')
    expect(trigger.getAttribute('aria-controls')).toBe('my-panel')
  })

  it('points every trigger at the one panel', async () => {
    const root = await mount(`
      <div x-collapsible>
        <button x-collapsible:trigger id="first">Toggle</button>
        <button x-collapsible:trigger id="second">Toggle</button>
        <div x-collapsible:panel hidden>Content</div>
      </div>
    `)
    const first = root.querySelector('#first')
    const second = root.querySelector('#second')
    const { panel } = parts(root)

    expect(first.getAttribute('aria-controls')).toBe(panel.id)
    expect(second.getAttribute('aria-controls')).toBe(panel.id)

    first.click()
    await flush()
    expect(second.getAttribute('aria-expanded')).toBe('true')

    second.click()
    await flush()
    expect(first.getAttribute('aria-expanded')).toBe('false')
  })

  it('gives each root its own panel id', async () => {
    document.body.innerHTML = `
      <div x-collapsible id="first">
        <button x-collapsible:trigger>Toggle</button>
        <div x-collapsible:panel hidden>Content</div>
      </div>
      <div x-collapsible id="second">
        <button x-collapsible:trigger>Toggle</button>
        <div x-collapsible:panel hidden>Content</div>
      </div>
    `
    await flush()
    const first = parts(document.querySelector('#first'))
    const second = parts(document.querySelector('#second'))

    // The number identifies the instance and the suffix identifies the part.
    expect(first.panel.id).toMatch(/^crux-ui-collapsible-\d+-panel$/)
    expect(second.panel.id).toMatch(/^crux-ui-collapsible-\d+-panel$/)
    expect(first.panel.id).not.toBe(second.panel.id)
    expect(first.trigger.getAttribute('aria-controls')).toBe(first.panel.id)
    expect(second.trigger.getAttribute('aria-controls')).toBe(second.panel.id)
  })

  it('warns when an author-provided panel id is already taken', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    document.body.innerHTML = `
      <div id="my-panel">Something else already owns this id</div>
      <div x-collapsible>
        <button x-collapsible:trigger>Toggle</button>
        <div x-collapsible:panel id="my-panel" hidden>Content</div>
      </div>
    `
    await flush()

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Duplicate id "my-panel"'),
      expect.anything()
    )
    warn.mockRestore()
  })

  it('warns when two panels are given the same author id', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    document.body.innerHTML = `
      <div x-collapsible>
        <button x-collapsible:trigger>One</button>
        <div x-collapsible:panel id="shared" hidden>First</div>
      </div>
      <div x-collapsible>
        <button x-collapsible:trigger>Two</button>
        <div x-collapsible:panel id="shared" hidden>Second</div>
      </div>
    `
    await flush()

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Duplicate id "shared"'),
      expect.anything()
    )
    warn.mockRestore()
  })

  it('stays quiet for a unique author-provided panel id', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await mountCollapsible({ panel: 'id="unique-panel" hidden' })

    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('uses hidden="until-found" and opens on beforematch', async () => {
    const { root, trigger, panel } = await mountCollapsible({
      root: 'hidden-until-found',
    })

    expect(panel.getAttribute('hidden')).toBe('until-found')
    expect(panel.style.display).toBe('')

    panel.dispatchEvent(new Event('beforematch'))
    await flush()
    expect(panel.hasAttribute('hidden')).toBe(false)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(root.hasAttribute('data-open')).toBe(true)
  })

  it('stays closed on beforematch when disabled', async () => {
    const { root, trigger, panel } = await mountCollapsible({
      root: 'disabled hidden-until-found',
    })

    // The browser fires beforematch, then strips the hidden attribute
    // itself — simulate both halves.
    panel.dispatchEvent(new Event('beforematch'))
    panel.removeAttribute('hidden')
    await settle()

    expect(panel.getAttribute('hidden')).toBe('until-found')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(root.hasAttribute('data-open')).toBe(false)
  })

  it('warns about an unknown part', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await mount(`
      <div x-collapsible>
        <div x-collapsible:bogus>Nope</div>
      </div>
    `)

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Unknown part "x-collapsible:bogus"'),
      expect.anything()
    )
    warn.mockRestore()
  })

  it('warns when a part is used outside a root', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await mount(`<div x-data><button x-collapsible:trigger>Toggle</button></div>`)

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('x-collapsible:trigger must be inside x-collapsible'),
      expect.anything()
    )
    warn.mockRestore()
  })

  it('exposes an inert $collapsible outside a root', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const root = await mount(`
      <div x-data>
        <span x-text="String($collapsible.isOpen)"></span>
        <button type="button" @click="$collapsible.toggle()">Toggle</button>
      </div>
    `)

    expect(root.querySelector('span').textContent).toBe('false')

    root.querySelector('button').click()
    await flush()
    expect(root.querySelector('span').textContent).toBe('false')
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('$collapsible was used outside of x-collapsible'),
      expect.anything()
    )
    warn.mockRestore()
  })

  it('composes with x-collapse, which takes over visibility', async () => {
    const { trigger, panel } = await mountCollapsible({
      panel: 'x-collapse.duration.50ms hidden',
    })

    // Closed via x-collapse's mechanism (height 0 + hidden), not display:none.
    expect(panel.style.height).toBe('0px')
    expect(panel.hidden).toBe(true)

    trigger.click()
    await settle()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(panel.hidden).toBe(false)
    expect(panel.style.display).not.toBe('none')

    trigger.click()
    await vi.waitFor(() => expect(panel.hidden).toBe(true))
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })
})
