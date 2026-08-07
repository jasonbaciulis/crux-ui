# Crux

Headless, unstyled, accessible UI primitives for [Alpine.js](https://alpinejs.dev).

> **Status: under construction.** This 0.0.x release exists to claim the
> package name while the first primitives are built. Follow along at
> [github.com/jasonbaciulis/crux-ui](https://github.com/jasonbaciulis/crux-ui).

Crux is the layer for your UI: WAI-ARIA
patterns, keyboard navigation, and focus management with zero styling
opinions. Bring your own markup and CSS; Crux handles the behavior.

## Planned primitives

accordion, carousel, combobox, dialog, drawer, popover, tabs, switch, radio group,
select.

## Usage (once real)

```js
import Alpine from 'alpinejs'
import Crux from 'crux-ui'

Alpine.plugin(Crux)
Alpine.start()
```

## License

MIT © Jason Baciulis
