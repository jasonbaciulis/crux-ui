import { flush } from './helpers.js'

// Alpine's cleanup must run while jsdom's globals exist; at environment
// teardown, its MutationObserver fires after they are deleted.
afterEach(async () => {
  document.body.replaceChildren()
  await flush()
})
