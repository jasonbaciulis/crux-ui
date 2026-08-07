import Alpine from 'alpinejs'
import collapse from '@alpinejs/collapse'
import Crux from '../src/index.js'

// Alpine picks up injected markup via MutationObserver; a macrotask
// guarantees init has run.
const flush = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
const raf = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })

// Alpine applies x-show display changes on the next animation frame, so
// assertions about a toggled panel's display need to settle through one.
const settle = async () => {
  await flush()
  await raf()
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
    expect(panel.id).toMatch(/^crux-ui-collapsible-panel-/)
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

  it('honors disabled', async () => {
    const { root, trigger } = await mountCollapsible({ root: 'disabled' })

    expect(root.hasAttribute('data-disabled')).toBe(true)
    expect(trigger.hasAttribute('data-disabled')).toBe(true)
    expect(trigger.disabled).toBe(true)

    trigger.click()
    await flush()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
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
