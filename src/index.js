// Crux UI — headless, unstyled, accessible UI primitives for Alpine.js.
// https://github.com/jasonbaciulis/crux-ui

import accordion from './accordion.js'
import collapsible from './collapsible.js'

export default function Crux(Alpine) {
  accordion(Alpine)
  collapsible(Alpine)
}
