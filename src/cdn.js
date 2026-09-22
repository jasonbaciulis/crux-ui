// CDN build entry: the script tag must come before Alpine's, so this
// listener is registered when Alpine fires alpine:init.
import Crux from './index.js'

document.addEventListener('alpine:init', () => globalThis.Alpine.plugin(Crux))
