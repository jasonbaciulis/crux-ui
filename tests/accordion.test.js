import Alpine from 'alpinejs'
import collapse from '@alpinejs/collapse'
import Crux from '../src/index.js'
import { flush, mount, settle } from './helpers.js'

beforeAll(() => {
  window.Alpine = Alpine
  Alpine.plugin(collapse)
  Alpine.plugin(Crux)
  Alpine.start()
})

const itemParts = (item) => ({
  item,
  header: item.querySelector(String.raw`[x-accordion\:header]`),
  trigger: item.querySelector(String.raw`[x-accordion\:trigger]`),
  panel: item.querySelector(String.raw`[x-accordion\:panel]`),
})

const itemsOf = (root) =>
  [...root.querySelectorAll(String.raw`[x-accordion\:item]`)].map((item) => itemParts(item))

// The canonical two-item skeleton most tests share; options carry the
// per-test attribute variations.
async function mountAccordion({ root = '', first = '', second = '', trigger = 'button' } = {}) {
  const el = await mount(`
    <div x-data x-accordion ${root}>
      <div x-accordion:item value="shipping" ${first}>
        <h3 x-accordion:header><${trigger} x-accordion:trigger>Shipping</${trigger}></h3>
        <div x-accordion:panel hidden>Shipping content</div>
      </div>
      <div x-accordion:item value="returns" ${second}>
        <h3 x-accordion:header><${trigger} x-accordion:trigger>Returns</${trigger}></h3>
        <div x-accordion:panel hidden>Returns content</div>
      </div>
    </div>
  `)
  const [shipping, returns] = itemsOf(el)
  return { root: el, shipping, returns }
}

const isShown = (panel) => panel.style.display !== 'none'
const instanceNumber = (id) => id.match(/-(\d+)-/)[1]

describe('x-accordion', () => {
  it('initializes closed by default with full ARIA wiring', async () => {
    const { shipping } = await mountAccordion()
    const { item, header, trigger, panel } = shipping

    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.getAttribute('aria-controls')).toBe(panel.id)
    expect(trigger.getAttribute('type')).toBe('button')
    expect(trigger.id).toMatch(/^crux-ui-accordion-item-\d+-trigger$/)
    expect(panel.id).toMatch(/^crux-ui-accordion-item-\d+-panel$/)
    expect(panel.getAttribute('role')).toBe('region')
    expect(panel.getAttribute('aria-labelledby')).toBe(trigger.id)
    expect(panel.hasAttribute('hidden')).toBe(false)
    expect(panel.style.display).toBe('none')

    for (const part of [item, header, panel]) {
      expect(part.hasAttribute('data-closed')).toBe(true)
      expect(part.hasAttribute('data-open')).toBe(false)
    }
    expect(trigger.hasAttribute('data-panel-open')).toBe(false)
    // Base UI's trigger reports its panel through data-panel-open only.
    expect(trigger.hasAttribute('data-closed')).toBe(false)
    expect(trigger.hasAttribute('data-open')).toBe(false)
  })

  it('gives the trigger and panel of one item the same instance number', async () => {
    const { shipping, returns } = await mountAccordion()

    expect(instanceNumber(shipping.trigger.id)).toBe(instanceNumber(shipping.panel.id))
    expect(shipping.panel.id).not.toBe(returns.panel.id)
  })

  it('marks every item part with its index', async () => {
    const { shipping, returns } = await mountAccordion()

    for (const part of Object.values(shipping)) {
      expect(part.getAttribute('data-index')).toBe('0')
    }
    for (const part of Object.values(returns)) {
      expect(part.getAttribute('data-index')).toBe('1')
    }
  })

  it('opens the items listed in default-value', async () => {
    const { shipping, returns } = await mountAccordion({
      root: 'multiple default-value="shipping, returns"',
    })

    expect(shipping.trigger.getAttribute('aria-expanded')).toBe('true')
    expect(returns.trigger.getAttribute('aria-expanded')).toBe('true')
    expect(isShown(shipping.panel)).toBe(true)
    expect(shipping.item.hasAttribute('data-open')).toBe(true)
    expect(shipping.header.hasAttribute('data-open')).toBe(true)
    expect(shipping.panel.hasAttribute('data-open')).toBe(true)
    expect(shipping.trigger.hasAttribute('data-panel-open')).toBe(true)
  })

  it('reads config bound with Alpine expressions', async () => {
    const el = await mount(`
      <div x-data="{ openItems: ['shipping', 'returns'], allowMany: true }">
        <div x-accordion :default-value="openItems" :multiple="allowMany">
          <div x-accordion:item value="shipping">
            <button x-accordion:trigger>Shipping</button>
            <div x-accordion:panel hidden>Shipping content</div>
          </div>
          <div x-accordion:item value="returns">
            <button x-accordion:trigger>Returns</button>
            <div x-accordion:panel hidden>Returns content</div>
          </div>
        </div>
      </div>
    `)
    const [shipping, returns] = itemsOf(el)

    expect(shipping.trigger.getAttribute('aria-expanded')).toBe('true')
    expect(returns.trigger.getAttribute('aria-expanded')).toBe('true')

    shipping.trigger.click()
    await flush()
    // Still multiple mode: closing one leaves the other open.
    expect(returns.trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('reads item values bound inside x-for', async () => {
    const el = await mount(`
      <div x-data="{ faqs: [{ slug: 'shipping' }, { slug: 'returns' }] }">
        <div x-accordion default-value="returns">
          <template x-for="faq in faqs" :key="faq.slug">
            <div x-accordion:item :value="faq.slug">
              <button x-accordion:trigger x-text="faq.slug"></button>
              <div x-accordion:panel hidden>Content</div>
            </div>
          </template>
        </div>
      </div>
    `)
    const [shipping, returns] = itemsOf(el)

    expect(shipping.trigger.getAttribute('aria-expanded')).toBe('false')
    expect(returns.trigger.getAttribute('aria-expanded')).toBe('true')
    expect(returns.item.getAttribute('data-index')).toBe('1')
  })

  it('keeps one item open at a time by default', async () => {
    const { shipping, returns } = await mountAccordion()
    const events = []
    document.addEventListener('accordion-change', (event) => {
      events.push(event.detail.value)
    })

    shipping.trigger.click()
    await settle()
    expect(isShown(shipping.panel)).toBe(true)

    returns.trigger.click()
    await settle()
    expect(shipping.trigger.getAttribute('aria-expanded')).toBe('false')
    expect(isShown(shipping.panel)).toBe(false)
    expect(returns.trigger.getAttribute('aria-expanded')).toBe('true')
    expect(isShown(returns.panel)).toBe(true)

    expect(events).toEqual([['shipping'], ['returns']])
  })

  it('closes the open item when its trigger is pressed again', async () => {
    const { root, shipping } = await mountAccordion({ root: 'default-value="shipping"' })
    const events = []
    root.addEventListener('accordion-change', (event) => {
      events.push(event.detail.value)
    })

    shipping.trigger.click()
    await settle()
    expect(shipping.trigger.getAttribute('aria-expanded')).toBe('false')
    expect(isShown(shipping.panel)).toBe(false)
    expect(events).toEqual([[]])
  })

  it('keeps several items open with multiple', async () => {
    const { shipping, returns } = await mountAccordion({ root: 'multiple' })
    const events = []
    document.addEventListener('accordion-change', (event) => {
      events.push(event.detail.value)
    })

    shipping.trigger.click()
    returns.trigger.click()
    await settle()
    expect(isShown(shipping.panel)).toBe(true)
    expect(isShown(returns.panel)).toBe(true)

    shipping.trigger.click()
    await settle()
    expect(isShown(shipping.panel)).toBe(false)
    expect(isShown(returns.panel)).toBe(true)

    expect(events.at(-1)).toEqual(['returns'])
  })

  it('exposes the panel size as CSS variables when open', async () => {
    const { shipping } = await mountAccordion()

    expect(shipping.panel.style.getPropertyValue('--accordion-panel-height')).toBe('')

    shipping.trigger.click()
    await settle()
    expect(shipping.panel.style.getPropertyValue('--accordion-panel-height')).toMatch(/px$/)
    expect(shipping.panel.style.getPropertyValue('--accordion-panel-width')).toMatch(/px$/)
  })

  it('supports x-model as controlled state', async () => {
    const el = await mount(`
      <div x-data="{ openItems: ['returns'] }">
        <div x-accordion x-model="openItems">
          <div x-accordion:item value="shipping">
            <button x-accordion:trigger>Shipping</button>
            <div x-accordion:panel hidden>Shipping content</div>
          </div>
          <div x-accordion:item value="returns">
            <button x-accordion:trigger>Returns</button>
            <div x-accordion:panel hidden>Returns content</div>
          </div>
        </div>
        <span x-text="openItems.join(',')"></span>
        <button type="button" id="open-outside" @click="openItems = ['shipping']">Open</button>
      </div>
    `)
    const [shipping, returns] = itemsOf(el)
    const mirror = el.querySelector('span')

    await settle()
    expect(returns.trigger.getAttribute('aria-expanded')).toBe('true')

    shipping.trigger.click()
    await settle()
    expect(mirror.textContent).toBe('shipping')
    expect(returns.trigger.getAttribute('aria-expanded')).toBe('false')

    shipping.trigger.click()
    await settle()
    expect(mirror.textContent).toBe('')

    el.querySelector('#open-outside').click()
    await settle()
    expect(shipping.trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('lets x-model override default-value', async () => {
    const el = await mount(`
      <div x-data="{ openItems: [] }">
        <div x-accordion default-value="shipping" x-model="openItems">
          <div x-accordion:item value="shipping">
            <button x-accordion:trigger>Shipping</button>
            <div x-accordion:panel>Shipping content</div>
          </div>
        </div>
      </div>
    `)
    const [shipping] = itemsOf(el)

    await settle()
    expect(shipping.trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('honors disabled on the root', async () => {
    const { root, shipping, returns } = await mountAccordion({ root: 'disabled' })

    expect(root.hasAttribute('data-disabled')).toBe(true)
    for (const part of Object.values(shipping)) {
      expect(part.hasAttribute('data-disabled')).toBe(true)
    }
    expect(shipping.trigger.disabled).toBe(true)
    expect(returns.trigger.disabled).toBe(true)
  })

  it('follows a bound disabled on the root and on an item', async () => {
    const el = await mount(`
      <div x-data="{ rootLocked: true, itemLocked: true }">
        <div x-accordion :disabled="rootLocked">
          <div x-accordion:item value="shipping" :disabled="itemLocked">
            <button x-accordion:trigger>Shipping</button>
            <div x-accordion:panel hidden>Shipping content</div>
          </div>
        </div>
      </div>
    `)
    const [shipping] = itemsOf(el)
    const data = Alpine.$data(el)

    expect(shipping.trigger.disabled).toBe(true)

    data.rootLocked = false
    await flush()
    expect(shipping.trigger.disabled).toBe(true)

    data.itemLocked = false
    await flush()
    expect(shipping.trigger.disabled).toBe(false)
    expect(shipping.item.hasAttribute('data-disabled')).toBe(false)
  })

  it('reads disabled="false" as not disabled', async () => {
    const { shipping } = await mountAccordion({ first: 'disabled="false"' })

    expect(shipping.trigger.disabled).toBe(false)
  })

  it('honors disabled on an item', async () => {
    const { root, shipping, returns } = await mountAccordion({ first: 'disabled' })

    expect(root.hasAttribute('data-disabled')).toBe(false)
    expect(shipping.item.hasAttribute('data-disabled')).toBe(true)
    expect(shipping.trigger.disabled).toBe(true)
    expect(returns.item.hasAttribute('data-disabled')).toBe(false)
    expect(returns.trigger.disabled).toBe(false)
  })

  // A native button ignores clicks by itself, so a div trigger is the only way
  // to reach the disabled guard on the interaction handlers.
  it('ignores user interaction on a disabled item', async () => {
    const { shipping } = await mountAccordion({ first: 'disabled', trigger: 'div' })

    expect(shipping.trigger.getAttribute('aria-disabled')).toBe('true')

    shipping.trigger.click()
    shipping.trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    shipping.trigger.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    await flush()
    expect(shipping.item.hasAttribute('data-open')).toBe(false)
  })

  it('still obeys $accordion while disabled', async () => {
    const root = await mount(`
      <div x-data x-accordion disabled>
        <div x-accordion:item value="shipping">
          <button x-accordion:trigger>Shipping</button>
          <div x-accordion:panel hidden>Shipping content</div>
        </div>
        <button type="button" id="via-magic" @click="$accordion.open('shipping')">Open</button>
      </div>
    `)
    const [shipping] = itemsOf(root)

    root.querySelector('#via-magic').click()
    await flush()
    expect(shipping.trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('makes non-button triggers keyboard-operable', async () => {
    const { shipping } = await mountAccordion({ trigger: 'div' })

    expect(shipping.trigger.getAttribute('role')).toBe('button')
    expect(shipping.trigger.getAttribute('tabindex')).toBe('0')

    shipping.trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await flush()
    expect(shipping.trigger.getAttribute('aria-expanded')).toBe('true')

    shipping.trigger.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    await flush()
    expect(shipping.trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('leaves a heading element as the header', async () => {
    const { shipping } = await mountAccordion()

    expect(shipping.header.hasAttribute('role')).toBe(false)
    expect(shipping.header.hasAttribute('aria-level')).toBe(false)
  })

  it('exposes a non-heading header as a level 3 heading', async () => {
    const root = await mount(`
      <div x-data x-accordion>
        <div x-accordion:item value="shipping">
          <div x-accordion:header id="default-level"><button x-accordion:trigger>Shipping</button></div>
          <div x-accordion:panel hidden>Shipping content</div>
        </div>
        <div x-accordion:item value="returns">
          <div x-accordion:header id="author-level" aria-level="2"><button x-accordion:trigger>Returns</button></div>
          <div x-accordion:panel hidden>Returns content</div>
        </div>
      </div>
    `)
    const defaultLevel = root.querySelector('#default-level')
    const authorLevel = root.querySelector('#author-level')

    expect(defaultLevel.getAttribute('role')).toBe('heading')
    expect(defaultLevel.getAttribute('aria-level')).toBe('3')
    expect(authorLevel.getAttribute('aria-level')).toBe('2')
  })

  it('generates a value for an item without one', async () => {
    const root = await mount(`
      <div x-data x-accordion>
        <div x-accordion:item>
          <button x-accordion:trigger>Shipping</button>
          <div x-accordion:panel hidden>Shipping content</div>
        </div>
        <span x-text="$accordion.value.join(',')"></span>
      </div>
    `)
    const [shipping] = itemsOf(root)

    shipping.trigger.click()
    await settle()
    expect(isShown(shipping.panel)).toBe(true)
    expect(root.querySelector('span').textContent).toMatch(/^crux-ui-accordion-item-\d+$/)
  })

  it('exposes the $accordion magic within the root', async () => {
    const root = await mount(`
      <div x-data x-accordion multiple>
        <div x-accordion:item value="shipping">
          <button x-accordion:trigger>Shipping</button>
          <div x-accordion:panel hidden>Shipping content</div>
        </div>
        <span x-text="$accordion.value.join(',')"></span>
        <i x-text="String($accordion.isOpen('shipping'))"></i>
        <button type="button" id="open" @click="$accordion.open('shipping')">Open</button>
        <button type="button" id="close" @click="$accordion.close('shipping')">Close</button>
        <button type="button" id="toggle" @click="$accordion.toggle('shipping')">Toggle</button>
      </div>
    `)
    const value = root.querySelector('span')
    const isOpen = root.querySelector('i')

    expect(isOpen.textContent).toBe('false')

    root.querySelector('#open').click()
    root.querySelector('#open').click()
    await flush()
    expect(value.textContent).toBe('shipping')
    expect(isOpen.textContent).toBe('true')

    root.querySelector('#close').click()
    await flush()
    expect(value.textContent).toBe('')

    root.querySelector('#toggle').click()
    await flush()
    expect(value.textContent).toBe('shipping')
  })

  it('initializes state before user bindings on the root element', async () => {
    const { root, shipping } = await mountAccordion({
      root: `:data-count="$accordion.value.length"`,
    })

    expect(root.getAttribute('data-count')).toBe('0')

    shipping.trigger.click()
    await flush()
    expect(root.getAttribute('data-count')).toBe('1')
  })

  it('scopes nested accordions to the nearest root and item', async () => {
    const root = await mount(`
      <div x-data x-accordion default-value="outer">
        <div x-accordion:item value="outer">
          <button x-accordion:trigger>Outer</button>
          <div x-accordion:panel>
            <div x-accordion id="inner">
              <div x-accordion:item value="inner">
                <button x-accordion:trigger>Inner</button>
                <div x-accordion:panel hidden>Inner content</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `)
    const [outer, inner] = itemsOf(root)

    inner.trigger.click()
    await flush()
    expect(inner.trigger.getAttribute('aria-expanded')).toBe('true')
    expect(outer.trigger.getAttribute('aria-expanded')).toBe('true')
    expect(inner.item.getAttribute('data-index')).toBe('0')
  })

  it('preserves author-provided trigger and panel ids', async () => {
    const root = await mount(`
      <div x-data x-accordion>
        <div x-accordion:item value="shipping">
          <button x-accordion:trigger id="my-trigger">Shipping</button>
          <div x-accordion:panel id="my-panel" hidden>Shipping content</div>
        </div>
      </div>
    `)
    const [shipping] = itemsOf(root)

    expect(shipping.trigger.id).toBe('my-trigger')
    expect(shipping.panel.id).toBe('my-panel')
    expect(shipping.trigger.getAttribute('aria-controls')).toBe('my-panel')
    expect(shipping.panel.getAttribute('aria-labelledby')).toBe('my-trigger')
  })

  it('warns when an author-provided id is already taken', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    document.body.innerHTML = `
      <div id="my-trigger">Something else already owns this id</div>
      <div x-data x-accordion>
        <div x-accordion:item value="shipping">
          <button x-accordion:trigger id="my-trigger">Shipping</button>
          <div x-accordion:panel hidden>Shipping content</div>
        </div>
      </div>
    `
    await flush()

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Duplicate id "my-trigger" on x-accordion:trigger'),
      expect.anything()
    )
    warn.mockRestore()
  })

  it('uses hidden="until-found" and opens on beforematch', async () => {
    const { shipping, returns } = await mountAccordion({
      root: 'hidden-until-found default-value="returns"',
    })

    expect(shipping.panel.getAttribute('hidden')).toBe('until-found')
    expect(shipping.panel.style.display).toBe('')

    shipping.panel.dispatchEvent(new Event('beforematch'))
    await flush()
    expect(shipping.panel.hasAttribute('hidden')).toBe(false)
    expect(shipping.trigger.getAttribute('aria-expanded')).toBe('true')
    // Single mode: the match opens its item and closes the other.
    expect(returns.panel.getAttribute('hidden')).toBe('until-found')
  })

  it('stays closed on beforematch when the item is disabled', async () => {
    const { shipping } = await mountAccordion({
      root: 'hidden-until-found',
      first: 'disabled',
    })

    // The browser fires beforematch, then strips the hidden attribute
    // itself — simulate both halves.
    shipping.panel.dispatchEvent(new Event('beforematch'))
    shipping.panel.removeAttribute('hidden')
    await settle()

    expect(shipping.panel.getAttribute('hidden')).toBe('until-found')
    expect(shipping.trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('warns about an unknown part', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await mount(`<div x-data x-accordion><div x-accordion:bogus>Nope</div></div>`)

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Unknown part "x-accordion:bogus"'),
      expect.anything()
    )
    warn.mockRestore()
  })

  it('warns when an item is used outside a root', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await mount(`<div x-data><div x-accordion:item value="shipping"></div></div>`)

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('x-accordion:item must be inside x-accordion'),
      expect.anything()
    )
    warn.mockRestore()
  })

  it('warns when a part is used outside an item', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await mount(`<div x-data x-accordion><button x-accordion:trigger>Toggle</button></div>`)

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('x-accordion:trigger must be inside x-accordion:item'),
      expect.anything()
    )
    warn.mockRestore()
  })

  it('exposes an inert $accordion outside a root', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const root = await mount(`
      <div x-data>
        <span x-text="String($accordion.isOpen('shipping'))"></span>
        <button type="button" @click="$accordion.open('shipping')">Open</button>
      </div>
    `)

    root.querySelector('button').click()
    await flush()
    expect(root.querySelector('span').textContent).toBe('false')
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('$accordion was used outside of x-accordion'),
      expect.anything()
    )
    warn.mockRestore()
  })

  it('composes with x-collapse, which takes over visibility', async () => {
    const root = await mount(`
      <div x-data x-accordion>
        <div x-accordion:item value="shipping">
          <button x-accordion:trigger>Shipping</button>
          <div x-accordion:panel x-collapse.duration.50ms hidden>Shipping content</div>
        </div>
      </div>
    `)
    const [shipping] = itemsOf(root)

    expect(shipping.panel.style.height).toBe('0px')
    expect(shipping.panel.hidden).toBe(true)

    shipping.trigger.click()
    await settle()
    expect(shipping.panel.hidden).toBe(false)

    shipping.trigger.click()
    await vi.waitFor(() => expect(shipping.panel.hidden).toBe(true))
  })
})
