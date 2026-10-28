// Alpine picks up injected markup via MutationObserver; a macrotask
// guarantees init has run.
export const flush = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0)
  })

export const animationFrame = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })

// Alpine applies x-show display changes on the next animation frame, so
// assertions about a toggled panel's display need to settle through one.
export const settle = async () => {
  await flush()
  await animationFrame()
  await flush()
}

export async function mount(html) {
  document.body.innerHTML = html
  await flush()
  return document.body.firstElementChild
}
