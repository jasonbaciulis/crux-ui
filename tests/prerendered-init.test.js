import Alpine from 'alpinejs'
import Crux from '../src/index.js'
import { flush } from './helpers.js'

// Server-rendered pages have their markup in the DOM before Alpine.start()
// runs, and Alpine's initial scan visits only [x-data]/[x-init] elements —
// which is why the markup contract requires a bare x-data on every
// standalone root. This file boots Alpine after mounting, unlike the other
// test files, which rely on the started instance's MutationObserver.

describe('markup rendered before Alpine.start()', () => {
  it('initializes x-data x-collapsible and x-accordion roots', async () => {
    document.body.innerHTML = `
      <div x-data x-collapsible>
        <button x-collapsible:trigger>Toggle</button>
        <div x-collapsible:panel hidden>Content</div>
      </div>
      <div x-data x-accordion default-value="shipping">
        <div x-accordion:item value="shipping">
          <button x-accordion:trigger>Shipping</button>
          <div x-accordion:panel>Content</div>
        </div>
      </div>
    `

    window.Alpine = Alpine
    Alpine.plugin(Crux)
    Alpine.start()
    await flush()

    const root = document.querySelector('[x-collapsible]')
    const trigger = document.querySelector(String.raw`[x-collapsible\:trigger]`)
    const panel = document.querySelector(String.raw`[x-collapsible\:panel]`)

    expect(root.hasAttribute('data-closed')).toBe(true)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.getAttribute('aria-controls')).toBe(panel.id)

    const accordionTrigger = document.querySelector(String.raw`[x-accordion\:trigger]`)
    expect(accordionTrigger.getAttribute('aria-expanded')).toBe('true')
  })
})
