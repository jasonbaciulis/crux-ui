import Alpine from 'alpinejs'
import Crux from '../src/index.js'

// Server-rendered pages have their markup in the DOM before Alpine.start()
// runs, and Alpine's initial scan visits only [x-data]/[x-init] elements —
// which is why the markup contract requires a bare x-data on every
// standalone root. This file boots Alpine after mounting, unlike the other
// test files, which rely on the started instance's MutationObserver.
const flush = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0)
  })

describe('markup rendered before Alpine.start()', () => {
  it('initializes an x-data x-collapsible root', async () => {
    document.body.innerHTML = `
      <div x-data x-collapsible>
        <button x-collapsible:trigger>Toggle</button>
        <div x-collapsible:panel hidden>Content</div>
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
  })
})
